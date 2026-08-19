import { useRef, useState } from 'react'
import { Upload, Camera, Loader2, ScanLine } from 'lucide-react'
import dayjs from 'dayjs'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import { useToast } from '../context/ToastContext'

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function normalizeDate(y, m, d) {
  const year = y < 100 ? 2000 + y : y
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseOcrText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  let amount = ''
  let date = dayjs().format('YYYY-MM-DD')
  let merchant = ''

  for (const line of lines) {
    const m = line.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/)
    if (m && !date) {
      const d = Number(m[1])
      const mo = Number(m[2])
      const y = Number(m[3])
      date = y > 1000 && d <= 31 && mo <= 12 ? normalizeDate(y, mo, d) : date
      continue
    }
    const md = line.toLowerCase().match(/\b(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+(\d{2,4})\b/)
    if (md && date === dayjs().format('YYYY-MM-DD')) {
      const mo = MONTHS_ES.indexOf(md[2].slice(0, 3)) + 1
      const d = Number(md[1])
      const y = Number(md[3])
      date = d <= 31 ? normalizeDate(y, mo, d) : date
    }
  }

  const totalRe = /(?:\btotal\b|\bimporte\b|\bpagar\b|\bamount\b|\bsuma\b|\befectivo\b)[^$\d]*\$?\s*([\d.,]+)/i
  for (const line of lines) {
    const m = line.match(totalRe)
    if (m) { amount = cleanNumber(m[1]); break }
  }
  if (!amount) {
    const nums = lines
      .map((l) => l.match(/\$?\s*([\d]{1,3}(?:[.,][\d]{3})*(?:[.,]\d{1,2}))\s*(?:MXN|MN|MX|\$)?/))
      .filter(Boolean)
      .map((m) => cleanNumber(m[1]))
      .filter((n) => n > 0)
    if (nums.length) amount = String(Math.max(...nums))
  }

  const ignored = /^(total|importe|pagar|subtotal|iva|rfc|folio|fecha|factura|gracias|visita|www\.|tel\b)/i
  const headerWords = /^(fecha|factura|ticket|recibo|venta|nota|original|copia|horario)/i
  const merchantLines = []
  for (const line of lines) {
    if (line.length > 45) continue
    if (/[\d]{4}/.test(line) && !/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/.test(line)) continue
    if (ignored.test(line) || headerWords.test(line)) continue
    merchantLines.push(line)
    if (merchantLines.length >= 2) break
  }
  merchant = merchantLines.join(' ').slice(0, 60)

  return { amount, date, merchant, raw: text }
}

function cleanNumber(str) {
  const s = str.replace(/[^\d.,]/g, '')
  if (!s) return ''
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma === -1 && lastDot === -1) return s
  if (lastDot > lastComma) return s.replace(/,/g, '')
  return s.replace(/\./g, '').replace(',', '.')
}

export default function OcrScanner({ open, onClose, accounts, categories, userId, onSaved }) {
  const { showToast } = useToast()
  const fileRef = useRef(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [step, setStep] = useState('pick')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const expenseCategories = categories.filter((c) => c.type === 'expense')

  const reset = () => {
    setImageUrl(null)
    setStep('pick')
    setProgress(0)
    setError('')
    setForm(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleFile = async (file) => {
    if (!file) return
    setError('')
    setImageUrl(URL.createObjectURL(file))
    setStep('processing')
    setProgress(0)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('spa', 1, {
        logger: (m) => { if (m.status === 'recognizing text') setProgress(m.progress || 0) }
      })
      const { data } = await worker.recognize(file)
      await worker.terminate()
      const parsed = parseOcrText(data.text || '')
      setForm({
        type: 'expense',
        description: parsed.merchant,
        date: parsed.date,
        amount: parsed.amount,
        category_id: expenseCategories[0]?.id || '',
        account_id: accounts[0]?.id || ''
      })
      setStep('result')
    } catch (err) {
      console.error(err)
      setError('No se pudo procesar la imagen. Intenta con una foto más nítida.')
      setStep('pick')
    }
  }

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setError('El monto es obligatorio'); return }
    if (!form.account_id) { setError('Selecciona una cuenta'); return }
    setSaving(true)
    const { error: err } = await supabase.from('transactions').insert({
      user_id: userId,
      account_id: form.account_id,
      category_id: form.category_id || null,
      type: form.type,
      amount: Number(form.amount),
      description: form.description.trim() || null,
      date: form.date
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    close()
    onSaved && onSaved()
    showToast('Gasto registrado desde OCR.', '📷')
  }

  return (
    <Modal open={open} onClose={close} title="📷 Escanear recibo (OCR)" width="lg">
      {step === 'pick' && (
        <div className="ocr-pick">
          <div className="dropzone" onClick={() => fileRef.current?.click()}>
            <ScanLine size={34} className="muted" />
            <p><strong>Toca para subir la foto de tu recibo</strong></p>
            <p className="muted small">JPG o PNG. El texto se detecta automáticamente (total, fecha y comercio).</p>
          </div>
          <div className="ocr-buttons">
            <button className="btn btn-outline" onClick={() => fileRef.current?.click()}><Upload size={15} /> Elegir imagen</button>
            <button className="btn btn-primary" onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment'; i.onchange = (e) => handleFile(e.target.files?.[0]); i.click() }}>
              <Camera size={15} /> Usar cámara
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
          {error && <div className="alert alert-error">{error}</div>}
        </div>
      )}

      {step === 'processing' && (
        <div className="ocr-processing">
          <Loader2 size={30} className="spin" />
          <p>Leyendo el recibo con OCR...</p>
          <div className="progress"><div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p className="muted small">{Math.round(progress * 100)}%</p>
        </div>
      )}

      {step === 'result' && form && (
        <div className="ocr-result">
          {imageUrl && <img src={imageUrl} alt="Recibo" className="ocr-thumb" />}
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-row">
            <div className="field">
              <label>Monto</label>
              <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Comercio / descripción</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Nombre del comercio" />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Categoría</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sin categoría</option>
                {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cuenta</label>
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
                <option value="">Selecciona...</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <p className="muted small">Revisa los datos detectados antes de guardar. Puedes corregirlos aquí.</p>
          <div className="ocr-actions">
            <button className="btn btn-outline" onClick={reset}>Escanear otro</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={15} className="spin" /> : 'Confirmar y guardar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}