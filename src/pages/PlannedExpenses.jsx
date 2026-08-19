import { useState } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, Check, Wallet, PiggyBank, AlertTriangle } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, formatDate, computeBalance, isCredit } from '../utils/format'
import { FREQUENCIES, EXPENSE_ICONS, frequencyLabel, advanceDue, upcomingWithin, sumUpcoming, monthlyPlanning } from '../utils/planned'
import Modal from '../components/Modal'
import Loader from '../components/Loader'
import StatCard from '../components/StatCard'
import { useToast } from '../context/ToastContext'
import dayjs from 'dayjs'

const emptyForm = {
  name: '',
  amount: '',
  frequency: 'monthly',
  next_due: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  icon: '🧾',
  notes: '',
  category_id: '',
  account_id: ''
}

export default function PlannedExpenses() {
  const { user } = useAuth()
  const { accounts, transactions, plannedExpenses, loading, reload } = useFinance()
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [daysWindow, setDaysWindow] = useState(60)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (e) => {
    setEditing(e)
    setForm({
      name: e.name,
      amount: e.amount,
      frequency: e.frequency || 'monthly',
      next_due: e.next_due,
      icon: e.icon || '🧾',
      notes: e.notes || '',
      category_id: e.category_id || '',
      account_id: e.account_id || ''
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    if (Number(form.amount) <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (!form.next_due) { setError('Selecciona la fecha del próximo pago'); return }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      amount: Number(form.amount),
      frequency: form.frequency,
      next_due: form.next_due,
      icon: form.icon || null,
      notes: form.notes.trim() || null,
      category_id: form.category_id || null,
      account_id: form.account_id || null
    }
    const res = editing
      ? await supabase.from('planned_expenses').update(payload).eq('id', editing.id)
      : await supabase.from('planned_expenses').insert({ ...payload, user_id: user.id })

    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    setModalOpen(false)
    reload()
    showToast(editing ? 'Gasto actualizado.' : 'Gasto programado.', '📅')
  }

  const markPaid = async (e) => {
    const accountId = e.account_id || accounts.find((a) => !isCredit(a))?.id
    if (!accountId) {
      showToast('Asigna una cuenta a este gasto (o crea una cuenta de débito).', '⚠️')
      return
    }
    const next = advanceDue(e.next_due, e.frequency || 'monthly')
    const tx = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: accountId,
      category_id: e.category_id || null,
      type: 'expense',
      amount: Number(e.amount),
      description: e.name,
      date: dayjs().format('YYYY-MM-DD')
    })
    if (tx.error) { showToast(tx.error.message, '❌'); return }
    const { error: err } = await supabase.from('planned_expenses').update({ next_due: next }).eq('id', e.id)
    if (err) { showToast(err.message, '❌'); return }
    reload()
    showToast(`Pago de "${e.name}" registrado. Siguiente: ${formatDate(next)}.`, '✅')
  }

  const handleDelete = async (e) => {
    if (!confirm(`¿Eliminar "${e.name}" de tus gastos programados?`)) return
    const { error: err } = await supabase.from('planned_expenses').delete().eq('id', e.id)
    if (err) alert(err.message)
    else {
      reload()
      showToast('Gasto eliminado.', '🗑️')
    }
  }

  if (loading) return <Loader />

  const disponible = accounts.filter((a) => !isCredit(a)).reduce((s, a) => s + computeBalance(a, transactions), 0)
  const next30 = sumUpcoming(plannedExpenses, 30)
  const nextWindow = upcomingWithin(plannedExpenses, daysWindow)
  const planning = monthlyPlanning(plannedExpenses)
  const alcanza = disponible - next30

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Gastos fijos y programados</h2>
          <p className="muted">Planifica tus pagos del mes y verifica si alcanzas con tu dinero disponible</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Programar gasto
        </button>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Gastos próximos 30 días"
          value={formatMoney(next30)}
          badge="Programados"
          badgeTone="indigo"
          sub={`${upcomingWithin(plannedExpenses, 30).length} pagos por venir`}
        />
        <StatCard
          label="Disponible en cuentas"
          value={formatMoney(disponible)}
          badge="Débito"
          badgeTone="emerald"
          sub="Sin contar tarjetas de crédito"
        />
        <StatCard
          label={alcanza >= 0 ? 'Te alcanza' : 'Te faltaría'}
          value={formatMoney(alcanza)}
          badge={alcanza >= 0 ? 'Suficiente' : 'Insuficiente'}
          badgeTone={alcanza >= 0 ? 'emerald' : 'rose'}
          sub="Disponible menos gastos de los próximos 30 días"
        />
        <StatCard
          label="Ahorro semanal sugerido"
          value={formatMoney(planning.weeklySaving)}
          badge="Ahorra por semana"
          badgeTone="amber"
          sub={`Para cubrir ${formatMoney(planning.dueThisMonth)} de gastos del mes`}
        />
      </div>

      {alcanza < 0 && (
        <div className="coach-alert">
          <div className="coach-icon"><AlertTriangle size={22} /></div>
          <div className="grow">
            <h4 className="coach-title">Alerta de liquidez</h4>
            <p className="coach-text">
              Tus gastos programados de los próximos 30 días ({formatMoney(next30)}) superan tu dinero disponible ({formatMoney(disponible)}).
              Revisa qué pagos puedes diferir o aparta {formatMoney(planning.weeklySaving)} por semana desde ahora.
            </p>
          </div>
        </div>
      )}

      {plannedExpenses.length === 0 ? (
        <div className="empty-state card">
          <CalendarClock size={32} className="muted" />
          <p className="muted">Programa tus gastos fijos (renta, internet, agua, luz, gas, pagos de tarjeta...) para planificar tu mes.</p>
          <button className="btn btn-primary" onClick={openCreate}>Programar mi primer gasto</button>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <h3>Calendario de pagos</h3>
              <div className="filter-buttons">
                {[30, 60, 90].map((n) => (
                  <button key={n} className={`btn btn-sm ${daysWindow === n ? 'btn-primary' : 'btn-outline'}`} onClick={() => setDaysWindow(n)}>
                    {n} días
                  </button>
                ))}
              </div>
            </div>
            {nextWindow.length === 0 ? (
              <p className="muted">No hay pagos programados en los próximos {daysWindow} días.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pago</th>
                      <th>Frecuencia</th>
                      <th>Fecha límite</th>
                      <th className="align-right">Monto</th>
                      <th className="align-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nextWindow.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <span className="account-card-icon small">{e.icon || '🧾'}</span> <strong>{e.name}</strong>
                          {e.notes && <span className="muted small"> · {e.notes}</span>}
                        </td>
                        <td><span className="cat-pill" style={{ background: '#eef2ff', color: '#4338ca' }}>{frequencyLabel(e.frequency)}</span></td>
                        <td className="nowrap">
                          {formatDate(e.next_due)}
                          <span className="muted small"> ({e.dueInDays === 0 ? 'hoy' : `en ${e.dueInDays} día(s)`})</span>
                        </td>
                        <td className="align-right amount expense">{formatMoney(e.amount)}</td>
                        <td className="align-right">
                          <div className="row-actions">
                            <button className="btn btn-sm btn-primary" onClick={() => markPaid(e)} title="Marcar como pagado"><Check size={13} /> Pagado</button>
                            <button className="icon-btn" onClick={() => openEdit(e)} aria-label="Editar"><Pencil size={15} /></button>
                            <button className="icon-btn danger" onClick={() => handleDelete(e)} aria-label="Eliminar"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Todos los gastos programados</h3>
            <div className="planned-list">
              {plannedExpenses.map((e) => (
                <div key={e.id} className="budget-row">
                  <span className="cat-dot">{e.icon || '🧾'}</span>
                  <strong>{e.name}</strong>
                  <span className="muted">{frequencyLabel(e.frequency)}</span>
                  <span className="muted small">próximo: {formatDate(e.next_due)}</span>
                  <strong className="amount expense">{formatMoney(e.amount)}</strong>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => openEdit(e)} aria-label="Editar"><Pencil size={15} /></button>
                    <button className="icon-btn danger" onClick={() => handleDelete(e)} aria-label="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar gasto programado' : 'Programar gasto'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" form="planned-form" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </>
        }>
        <form id="planned-form" onSubmit={handleSave}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label>Icono</label>
            <div className="icon-picker">
              {EXPENSE_ICONS.map((ic) => (
                <button key={ic} type="button" className={`icon-pick${form.icon === ic ? ' active' : ''}`} onClick={() => setForm({ ...form, icon: ic })}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="pe-name">Nombre del gasto</label>
            <input id="pe-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Internet, Renta, Agua, Luz, Gas, Pago tarjeta..." required />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="pe-amount">Monto</label>
              <input id="pe-amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required />
            </div>
            <div className="field">
              <label htmlFor="pe-freq">Frecuencia</label>
              <select id="pe-freq" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <small className="muted">Usa Bimestral para luz o gas.</small>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="pe-due">Próximo pago</label>
              <input id="pe-due" type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="pe-notes">Nota (opcional)</label>
              <input id="pe-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej. contrato, cuenta, número..." />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="pe-cat">Categoría (al pagar se registra el gasto)</label>
              <select id="pe-cat" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sin categoría</option>
                {categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pe-acc">Cuenta que paga (opcional)</label>
              <select id="pe-acc" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                <option value="">Usar primera cuenta</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}