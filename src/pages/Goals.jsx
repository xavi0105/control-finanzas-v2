import { useState } from 'react'
import { Plus, Pencil, Trash2, PiggyBank, CheckCircle2 } from 'lucide-react'
import dayjs from 'dayjs'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, formatDate } from '../utils/format'
import Modal from '../components/Modal'
import Loader from '../components/Loader'
import { useToast } from '../context/ToastContext'

export default function Goals() {
  const { user } = useAuth()
  const { goals, loading, reload } = useFinance()
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [depositGoal, setDepositGoal] = useState(null)
  const [form, setForm] = useState({ name: '', target_amount: '', saved_amount: '', deadline: '' })
  const [depositForm, setDepositForm] = useState({ amount: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', target_amount: '', saved_amount: '', deadline: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (g) => {
    setEditing(g)
    setForm({ name: g.name, target_amount: g.target_amount, saved_amount: g.saved_amount, deadline: g.deadline || '' })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    if (Number(form.target_amount) <= 0) { setError('La meta debe ser mayor a 0'); return }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      target_amount: Number(form.target_amount),
      saved_amount: Number(form.saved_amount) || 0,
      deadline: form.deadline || null
    }
    const res = editing
      ? await supabase.from('goals').update(payload).eq('id', editing.id)
      : await supabase.from('goals').insert({ ...payload, user_id: user.id })

    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    setModalOpen(false)
    reload()
    showToast(editing ? 'Meta actualizada.' : 'Meta creada.', '🎯')
  }

  const openDeposit = (g) => {
    setDepositGoal(g)
    setDepositForm({ amount: '' })
    setError('')
  }

  const handleDeposit = async (e) => {
    e.preventDefault()
    setError('')
    const amount = Number(depositForm.amount)
    if (!amount || amount <= 0) { setError('Ingresa un monto válido'); return }

    setSaving(true)
    const newSaved = Number(depositGoal.saved_amount) + amount
    const { error } = await supabase
      .from('goals')
      .update({ saved_amount: newSaved })
      .eq('id', depositGoal.id)
    setSaving(false)
    if (error) { setError(error.message); return }
    setDepositGoal(null)
    reload()
    showToast('Ahorro agregado a la meta.', '💰')
  }

  const handleDelete = async (g) => {
    if (!confirm(`¿Eliminar la meta "${g.name}"?`)) return
    const { error } = await supabase.from('goals').delete().eq('id', g.id)
    if (error) alert(error.message)
    else {
      reload()
      showToast('Meta eliminada.', '🗑️')
    }
  }

  if (loading) return <Loader />

  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount), 0)
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Metas de ahorro</h2>
          <p className="muted">
            Ahorrado: <strong>{formatMoney(totalSaved)}</strong> de <strong>{formatMoney(totalTarget)}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Nueva meta
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="empty-state card">
          <PiggyBank size={32} className="muted" />
          <p className="muted">Define una meta para empezar a ahorrar: un viaje, un auto, un fondo de emergencia...</p>
          <button className="btn btn-primary" onClick={openCreate}>Crear meta</button>
        </div>
      ) : (
        <div className="goal-list">
          {goals.map((g) => {
            const target = Number(g.target_amount)
            const saved = Number(g.saved_amount)
            const pct = Math.min(100, Math.round((saved / target) * 100))
            const completed = saved >= target
            const daysLeft = g.deadline ? dayjs(g.deadline).diff(dayjs(), 'day') : null

            return (
              <div key={g.id} className={`card goal-card${completed ? ' completed' : ''}`}>
                <div className="goal-head">
                  <div>
                    <h3>
                      {g.name}
                      {completed && <CheckCircle2 size={18} className="text-success inline" />}
                    </h3>
                    <small className="muted">
                      {formatMoney(saved)} de {formatMoney(target)}
                      {daysLeft !== null && (daysLeft >= 0 ? ` · ${daysLeft} días restantes` : ' · tiempo vencido')}
                    </small>
                  </div>
                  <div className="row-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => openDeposit(g)}>Agregar ahorro</button>
                    <button className="icon-btn" onClick={() => openEdit(g)} aria-label="Editar"><Pencil size={15} /></button>
                    <button className="icon-btn danger" onClick={() => handleDelete(g)} aria-label="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="goal-progress">
                  <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
                  <span className="goal-pct">{pct}%</span>
                </div>
                {g.deadline && <small className="muted">Fecha límite: {formatDate(g.deadline)}</small>}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar meta' : 'Nueva meta'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" form="goal-form" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </>
        }>
        <form id="goal-form" onSubmit={handleSave}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="goal-name">Nombre</label>
            <input id="goal-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Fondo de emergencia" required />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="goal-target">Meta ($)</label>
              <input id="goal-target" type="number" step="0.01" min="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} placeholder="0.00" required />
            </div>
            <div className="field">
              <label htmlFor="goal-saved">Ya ahorrado ($)</label>
              <input id="goal-saved" type="number" step="0.01" min="0" value={form.saved_amount} onChange={(e) => setForm({ ...form, saved_amount: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="goal-deadline">Fecha límite (opcional)</label>
            <input id="goal-deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal open={!!depositGoal} onClose={() => setDepositGoal(null)} title={`Agregar ahorro a "${depositGoal?.name || ''}"`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDepositGoal(null)}>Cancelar</button>
            <button className="btn btn-primary" form="deposit-form" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </>
        }>
        <form id="deposit-form" onSubmit={handleDeposit}>
          {error && <div className="alert alert-error">{error}</div>}
          <p className="muted small">Actualmente ahorrado: {depositGoal ? formatMoney(depositGoal.saved_amount) : ''}</p>
          <div className="field">
            <label htmlFor="dep-amount">Monto a agregar</label>
            <input id="dep-amount" type="number" step="0.01" min="0.01" value={depositForm.amount} onChange={(e) => setDepositForm({ amount: e.target.value })} placeholder="0.00" required autoFocus />
          </div>
        </form>
      </Modal>
    </div>
  )
}