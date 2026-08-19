import { useRef, useState } from 'react'
import { Download, Upload, Plus, Pencil, Trash2, Tag, AlertTriangle, Loader2, Target } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrency, setCurrency as setCurrencyPref, formatMoney } from '../utils/format'
import { exportTransactionsCsv, importTransactionsCsv } from '../utils/csv'
import Modal from '../components/Modal'
import Loader from '../components/Loader'
import { useToast } from '../context/ToastContext'

const CATEGORY_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#22c55e', '#eab308', '#06b6d4']

export default function Settings() {
  const { user } = useAuth()
  const { accounts, categories, transactions, budgets, loading, reload } = useFinance()
  const { showToast } = useToast()

  const [currency, setCurrency] = useState(getCurrency())
  const fileRef = useRef(null)

  const [budgetForm, setBudgetForm] = useState({ category_id: '', amount: '' })
  const [budgetError, setBudgetError] = useState('')

  const expenseCats = categories.filter((c) => c.type === 'expense')

  const [catModal, setCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [catForm, setCatForm] = useState({ name: '', type: 'expense', color: '#0ea5e9' })
  const [savingCat, setSavingCat] = useState(false)
  const [catError, setCatError] = useState('')

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const [dangerOpen, setDangerOpen] = useState(false)

  const openCreateCat = () => {
    setEditingCat(null)
    setCatForm({ name: '', type: 'expense', color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)] })
    setCatError('')
    setCatModal(true)
  }

  const openEditCat = (c) => {
    setEditingCat(c)
    setCatForm({ name: c.name, type: c.type, color: c.color || '#0ea5e9' })
    setCatError('')
    setCatModal(true)
  }

  const saveCat = async (e) => {
    e.preventDefault()
    setCatError('')
    if (!catForm.name.trim()) { setCatError('El nombre es obligatorio'); return }
    setSavingCat(true)
    const payload = { name: catForm.name.trim(), type: catForm.type, color: catForm.color }
    const res = editingCat
      ? await supabase.from('categories').update(payload).eq('id', editingCat.id)
      : await supabase.from('categories').insert({ ...payload, user_id: user.id })
    setSavingCat(false)
    if (res.error) { setCatError(res.error.message); return }
    setCatModal(false)
    reload()
    showToast(editingCat ? 'Categoría actualizada.' : 'Categoría creada.', '🏷️')
  }

  const deleteCat = async (c) => {
    if (!confirm(`¿Eliminar la categoría "${c.name}"? Las transacciones con esa categoría quedarán sin categoría.`)) return
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) alert(error.message)
    else {
      reload()
      showToast('Categoría eliminada.', '🗑️')
    }
  }

  const handleExport = () => {
    exportTransactionsCsv(transactions, accounts, categories)
    showToast('CSV exportado.', '📥')
  }

  const budgetedIds = new Set(budgets.map((b) => b.category_id))
  const expenseCatsWithoutBudget = expenseCats.filter((c) => !budgetedIds.has(c.id))

  const saveBudget = async (e) => {
    e.preventDefault()
    setBudgetError('')
    if (!budgetForm.category_id) { setBudgetError('Selecciona una categoría'); return }
    if (!budgetForm.amount || Number(budgetForm.amount) <= 0) { setBudgetError('Ingresa un monto mayor a 0'); return }
    const existing = budgets.find((b) => b.category_id === budgetForm.category_id)
    const payload = { user_id: user.id, category_id: budgetForm.category_id, amount: Number(budgetForm.amount) }
    const res = existing
      ? await supabase.from('budgets').update({ amount: payload.amount }).eq('id', existing.id)
      : await supabase.from('budgets').insert(payload)
    if (res.error) { setBudgetError(res.error.message); return }
    setBudgetForm({ category_id: '', amount: '' })
    setBudgetError('')
    reload()
    showToast(existing ? 'Presupuesto actualizado.' : 'Presupuesto creado.', '🎯')
  }

  const deleteBudget = async (b) => {
    if (!confirm('¿Eliminar este presupuesto?')) return
    const { error } = await supabase.from('budgets').delete().eq('id', b.id)
    if (error) alert(error.message)
    else {
      reload()
      showToast('Presupuesto eliminado.', '🗑️')
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await importTransactionsCsv(file, { accounts, categories, userId: user.id })
      setImportResult(result)
      reload()
      showToast(`${result.created} transacciones importadas.`, '📥')
    } catch (err) {
      setImportResult({ created: 0, skipped: [err.message] })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const changeCurrency = (code) => {
    setCurrency(code)
    setCurrencyPref(code)
    showToast('Moneda actualizada.', '💱')
  }

  const handleDeleteAll = async () => {
    if (!confirm('Esto eliminará TODOS tus datos (transacciones, cuentas, metas y categorías). Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) { alert(error.message); return }
    await supabase.from('goals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setDangerOpen(false)
    reload()
  }

  if (loading) return <Loader />

  const incomeCats = categories.filter((c) => c.type === 'income')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Ajustes</h2>
          <p className="muted">Personaliza tu aplicación y administra tus datos</p>
        </div>
      </div>

      <section className="card">
        <h3>Preferencias</h3>
        <div className="field">
          <label htmlFor="currency">Moneda</label>
          <select id="currency" value={currency} onChange={(e) => changeCurrency(e.target.value)}>
            <option value="MXN">MXN - Peso mexicano</option>
            <option value="USD">USD - Dólar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="COP">COP - Peso colombiano</option>
            <option value="ARS">ARS - Peso argentino</option>
            <option value="CLP">CLP - Peso chileno</option>
          </select>
          <small className="muted">La moneda se guarda en este navegador y solo afecta el formato de los montos.</small>
        </div>
      </section>

      <section className="card">
        <h3>Datos</h3>
        <div className="data-actions">
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={16} /> Exportar transacciones a CSV
          </button>
          <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Importar CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleImportFile} />
        </div>
        {importResult && (
          <div className="alert alert-info">
            Se importaron <strong>{importResult.created}</strong> transacciones.
            {importResult.skipped.length > 0 && (
              <div className="small">
                <strong>Omitidas ({importResult.skipped.length}):</strong>
                <ul className="skip-list">{importResult.skipped.slice(0, 20).map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        <div className="muted small">
          <p>Formato CSV: <code>fecha,tipo,monto,descripcion,categoria,cuenta</code></p>
          <p>
            Ejemplo: <code>2024-01-15,expense,250.50,Supermercado,Alimentación,Efectivo</code>
          </p>
          <p>Las categorías y cuentas deben existir y su nombre debe coincidir exactamente.</p>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3><Target size={16} /> Presupuestos por categoría</h3>
          <span className="muted small">Límite mensual por categoría de gasto</span>
        </div>
        <form onSubmit={saveBudget} className="budget-form">
          {budgetError && <div className="alert alert-error">{budgetError}</div>}
          <select value={budgetForm.category_id} onChange={(e) => setBudgetForm({ ...budgetForm, category_id: e.target.value })}>
            <option value="">Elige una categoría de gasto...</option>
            {expenseCatsWithoutBudget.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={budgetForm.amount}
            onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
            placeholder="Monto mensual"
          />
          <button className="btn btn-primary" type="submit" disabled={expenseCatsWithoutBudget.length === 0 && budgets.length > 0}>
            <Plus size={15} /> Guardar
          </button>
        </form>

        {budgets.length === 0 ? (
          <p className="muted small">Aún no tienes presupuestos. Define límites para controlar tus gastos por categoría.</p>
        ) : (
          <div className="budget-list">
            {budgets.map((b) => {
              const cat = categories.find((c) => c.id === b.category_id)
              return (
                <div key={b.id} className="budget-row">
                  <span className="cat-dot" style={{ background: cat?.color || '#94a3b8' }} />
                  <strong>{cat?.name || 'Categoría eliminada'}</strong>
                  <span className="muted">{formatMoney(b.amount)} / mes</span>
                  <div className="row-actions">
                    <button className="icon-btn danger" onClick={() => deleteBudget(b)} aria-label="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3><Tag size={16} /> Categorías</h3>
          <button className="btn btn-primary btn-sm" onClick={openCreateCat}><Plus size={14} /> Nueva</button>
        </div>

        <h4 className="section-sub">Gastos</h4>
        <div className="cat-grid">
          {expenseCats.map((c) => (
            <div key={c.id} className="cat-item" style={{ borderColor: c.color }}>
              <span className="cat-dot" style={{ background: c.color }} />
              <span>{c.name}</span>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => openEditCat(c)} aria-label="Editar"><Pencil size={14} /></button>
                <button className="icon-btn danger" onClick={() => deleteCat(c)} aria-label="Eliminar"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <h4 className="section-sub">Ingresos</h4>
        <div className="cat-grid">
          {incomeCats.map((c) => (
            <div key={c.id} className="cat-item" style={{ borderColor: c.color }}>
              <span className="cat-dot" style={{ background: c.color }} />
              <span>{c.name}</span>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => openEditCat(c)} aria-label="Editar"><Pencil size={14} /></button>
                <button className="icon-btn danger" onClick={() => deleteCat(c)} aria-label="Eliminar"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card danger-card">
        <h3><AlertTriangle size={16} /> Zona de peligro</h3>
        <p className="muted">Elimina todos tus datos de forma permanente. No podrás recuperarlos.</p>
        <button className="btn btn-danger" onClick={() => setDangerOpen(true)}>Eliminar todos mis datos</button>
      </section>

      <Modal open={catModal} onClose={() => setCatModal(false)} title={editingCat ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCatModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="cat-form" type="submit" disabled={savingCat}>{savingCat ? 'Guardando...' : 'Guardar'}</button>
          </>
        }>
        <form id="cat-form" onSubmit={saveCat}>
          {catError && <div className="alert alert-error">{catError}</div>}
          <div className="field">
            <label htmlFor="cat-name">Nombre</label>
            <input id="cat-name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ej. Renta" required />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="cat-type">Tipo</label>
              <select id="cat-type" value={catForm.type} onChange={(e) => setCatForm({ ...catForm, type: e.target.value })}>
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>
            <div className="field">
              <label>Color</label>
              <div className="color-picker">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${catForm.color === color ? ' selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => setCatForm({ ...catForm, color })}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={dangerOpen} onClose={() => setDangerOpen(false)} title="Confirmar eliminación"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDangerOpen(false)}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleDeleteAll}>Sí, eliminar todo</button>
          </>
        }>
        <p>Estás a punto de eliminar <strong>todos</strong> tus datos. ¿Deseas continuar?</p>
      </Modal>
    </div>
  )
}