import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search, ScanLine } from 'lucide-react'
import dayjs from 'dayjs'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, formatDate, TYPE_LABELS } from '../utils/format'
import Modal from '../components/Modal'
import Loader from '../components/Loader'
import OcrScanner from '../components/OcrScanner'
import { useToast } from '../context/ToastContext'

const emptyForm = {
  date: dayjs().format('YYYY-MM-DD'),
  type: 'expense',
  amount: '',
  description: '',
  category_id: '',
  account_id: ''
}

export default function Transactions() {
  const { user } = useAuth()
  const { accounts, categories, transactions, loading, reload } = useFinance()
  const { showToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [ocrOpen, setOcrOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterAccount, setFilterAccount] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => dayjs(t.date).format('YYYY-MM')))
    return [...set].sort().reverse()
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterAccount !== 'all' && t.account_id !== filterAccount) return false
      if (filterCategory !== 'all' && t.category_id !== filterCategory) return false
      if (filterMonth && dayjs(t.date).format('YYYY-MM') !== filterMonth) return false
      if (search && !`${t.description || ''}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [transactions, search, filterType, filterAccount, filterCategory, filterMonth])

  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const incomeCategories = categories.filter((c) => c.type === 'income')

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, account_id: accounts[0]?.id || '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description || '',
      category_id: t.category_id || '',
      account_id: t.account_id
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.amount || Number(form.amount) <= 0) { setError('Ingresa un monto mayor a 0'); return }
    if (!form.account_id) { setError('Selecciona una cuenta'); return }

    setSaving(true)
    const payload = {
      user_id: user.id,
      account_id: form.account_id,
      category_id: form.category_id || null,
      type: form.type,
      amount: Number(form.amount),
      description: form.description.trim() || null,
      date: form.date
    }

    const res = editing
      ? await supabase.from('transactions').update(payload).eq('id', editing.id)
      : await supabase.from('transactions').insert(payload)

    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    setModalOpen(false)
    reload()
    showToast(editing ? 'Transacción actualizada.' : 'Transacción registrada.', '✅')
  }

  const handleDelete = async (t) => {
    if (!confirm(`¿Eliminar la transacción "${t.description || 'sin descripción'}"?`)) return
    const { error } = await supabase.from('transactions').delete().eq('id', t.id)
    if (error) alert(error.message)
    else {
      reload()
      showToast('Transacción eliminada.', '🗑️')
    }
  }

  const categoryOptions = form.type === 'income' ? incomeCategories : expenseCategories

  if (loading) return <Loader />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Transacciones</h2>
          <p className="muted">{filtered.length} registros</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => setOcrOpen(true)}>
            <ScanLine size={16} /> Escanear recibo
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nueva transacción
          </button>
        </div>
      </div>

      <div className="filters card">
        <div className="input-wrap grow">
          <Search size={16} />
          <input
            placeholder="Buscar por descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">Todos los tipos</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </select>
        <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
          <option value="all">Todas las cuentas</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
          <option value="">Todos los meses</option>
          {months.map((m) => (
            <option key={m} value={m}>{dayjs(m).format('MMMM YYYY')}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card">
          <p className="muted">No hay transacciones con estos filtros.</p>
          <button className="btn btn-outline" onClick={openCreate}>Agregar una</button>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Cuenta</th>
                  <th className="align-right">Monto</th>
                  <th className="align-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const cat = categories.find((c) => c.id === t.category_id)
                  const acc = accounts.find((a) => a.id === t.account_id)
                  return (
                    <tr key={t.id}>
                      <td className="nowrap">{formatDate(t.date)}</td>
                      <td>{t.description || '—'}</td>
                      <td><span className={`badge ${t.type}`}>{TYPE_LABELS[t.type]}</span></td>
                      <td>
                        {cat
                          ? <span className="cat-pill" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.name}</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td className="muted nowrap">{acc?.name || '—'}</td>
                      <td className={`align-right amount ${t.type}`}>{t.type === 'income' ? '+' : '−'} {formatMoney(t.amount)}</td>
                      <td className="align-right">
                        <div className="row-actions">
                          <button className="icon-btn" onClick={() => openEdit(t)} aria-label="Editar"><Pencil size={15} /></button>
                          <button className="icon-btn danger" onClick={() => handleDelete(t)} aria-label="Eliminar"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar transacción' : 'Nueva transacción'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" form="transaction-form" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="transaction-form" onSubmit={handleSave}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-row">
            <div className="field">
              <label>Tipo</label>
              <div className="type-toggle">
                <button
                  type="button"
                  className={form.type === 'expense' ? 'active expense' : ''}
                  onClick={() => setForm({ ...form, type: 'expense', category_id: '' })}
                >Gasto</button>
                <button
                  type="button"
                  className={form.type === 'income' ? 'active income' : ''}
                  onClick={() => setForm({ ...form, type: 'income', category_id: '' })}
                >Ingreso</button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="tx-date">Fecha</label>
              <input
                id="tx-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="tx-amount">Monto</label>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="tx-desc">Descripción</label>
            <input
              id="tx-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ej. Compra del supermercado"
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="tx-cat">Categoría</label>
              <select id="tx-cat" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sin categoría</option>
                {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="tx-acc">Cuenta</label>
              <select id="tx-acc" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
                <option value="">Selecciona...</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      <OcrScanner
        open={ocrOpen}
        onClose={() => setOcrOpen(false)}
        accounts={accounts}
        categories={categories}
        userId={user.id}
        onSaved={reload}
      />
    </div>
  )
}