import { supabase } from '../lib/supabase'

export const CSV_HEADERS = [
  'fecha',
  'tipo',
  'monto',
  'descripcion',
  'categoria',
  'cuenta'
]

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeCsv(value) {
  const v = value == null ? '' : String(value)
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function exportTransactionsCsv(transactions, accounts, categories) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || ''
  const categoryName = (id) => categories.find((c) => c.id === id)?.name || ''

  const lines = [CSV_HEADERS.join(',')]
  for (const t of transactions) {
    const row = [
      t.date,
      t.type,
      t.amount,
      t.description || '',
      categoryName(t.category_id),
      accountName(t.account_id)
    ].map(escapeCsv)
    lines.push(row.join(','))
  }
  downloadFile(`transacciones-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;')
}

export async function importTransactionsCsv(file, { accounts, categories, userId, onLine }) {
  const text = await file.text()
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) throw new Error('El archivo CSV está vacío')

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const required = ['fecha', 'tipo', 'monto']
  for (const r of required) {
    if (!headers.includes(r)) throw new Error(`Falta la columna requerida: "${r}"`)
  }

  function parseLine(line) {
    const out = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = false
        } else current += ch
      } else if (ch === '"') inQuotes = true
      else if (ch === ',') { out.push(current); current = '' }
      else current += ch
    }
    out.push(current)
    return out
  }

  const categoryByName = (name) => categories.find((c) => c.name.toLowerCase() === String(name).trim().toLowerCase())
  const accountByName = (name) => accounts.find((a) => a.name.toLowerCase() === String(name).trim().toLowerCase())

  let created = 0
  const skipped = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    const obj = {}
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? '' })

    const type = String(obj.tipo || '').trim().toLowerCase()
    const amount = parseFloat(String(obj.monto).replace(/[$,\s]/g, ''))
    const date = obj.fecha && obj.fecha.trim() ? obj.fecha.trim() : null

    if (type !== 'income' && type !== 'expense') { skipped.push(`línea ${i + 1}: tipo inválido`); continue }
    if (!Number.isFinite(amount) || amount <= 0) { skipped.push(`línea ${i + 1}: monto inválido`); continue }

    const category = categoryByName(obj.categoria)
    if (obj.categoria && !category) { skipped.push(`línea ${i + 1}: categoría "${obj.categoria}" no existe`); continue }

    const account = accountByName(obj.cuenta)
    if (!account) { skipped.push(`línea ${i + 1}: cuenta "${obj.cuenta}" no existe`); continue }

    const payload = {
      user_id: userId,
      account_id: account.id,
      category_id: category ? category.id : null,
      type,
      amount,
      description: obj.descripcion || null,
      date
    }

    const { error } = await supabase.from('transactions').insert(payload)
    if (error) { skipped.push(`línea ${i + 1}: ${error.message}`); continue }
    created++
    if (onLine) onLine(created)
  }

  return { created, skipped }
}