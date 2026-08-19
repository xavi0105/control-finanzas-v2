import { useState } from 'react'
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, computeBalance, isCredit, accountBalanceDisplay, ACCOUNT_TYPES, accountTypeLabel } from '../utils/format'
import { BANKS, bankByCode, bankBadgeStyle } from '../utils/banks'
import Modal from '../components/Modal'
import Loader from '../components/Loader'
import { useToast } from '../context/ToastContext'

const ACCOUNT_ICONS = ['💳', '🏦', '👛', '💰', '🏠', '📱', '🏝️', '🪙', '💵', '🏧', '🐷', '🌱']

const emptyForm = {
  name: '',
  type: 'ahorro',
  description: '',
  initial_balance: '',
  credit_limit: '',
  cut_day: '',
  pay_day: '',
  interest_rate: '',
  icon: '',
  bank: '',
  fee_enabled: false,
  fee_type: 'annual',
  fee_amount: '',
  fee_day: '',
  fee_month: '',
  reminder_days: 7
}

function accountIcon(a) {
  return a.icon || (isCredit(a) ? '💳' : '🏦')
}

export default function Accounts() {
  const { user } = useAuth()
  const { accounts, transactions, loading, reload } = useFinance()
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const withBalances = accounts.map((a) => ({
    ...a,
    balance: computeBalance(a, transactions),
    display: accountBalanceDisplay(a, transactions)
  }))

  const disponible = withBalances.filter((a) => !isCredit(a)).reduce((s, a) => s + a.balance, 0)
  const deuda = withBalances.filter((a) => isCredit(a)).reduce((s, a) => s + a.balance, 0)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (a) => {
    setEditing(a)
    setForm({
      name: a.name,
      type: a.type,
      description: a.description || '',
      initial_balance: a.initial_balance ?? '',
      credit_limit: a.credit_limit ?? '',
      cut_day: a.cut_day ?? '',
      pay_day: a.pay_day ?? '',
      interest_rate: a.interest_rate ?? '',
      icon: a.icon || '',
      bank: a.bank || '',
      fee_enabled: Boolean(a.fee_type),
      fee_type: a.fee_type || 'annual',
      fee_amount: a.fee_amount ?? '',
      fee_day: a.fee_day ?? '',
      fee_month: a.fee_month ?? '',
      reminder_days: a.reminder_days ?? 7
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim() || null,
      initial_balance: form.initial_balance === '' ? 0 : Number(form.initial_balance),
      credit_limit: form.credit_limit === '' ? null : Number(form.credit_limit),
      cut_day: form.cut_day === '' ? null : Number(form.cut_day),
      pay_day: form.pay_day === '' ? null : Number(form.pay_day),
      interest_rate: form.interest_rate === '' ? 0 : Number(form.interest_rate),
      icon: form.icon || null,
      bank: form.bank || null,
      fee_type: form.fee_enabled ? form.fee_type : null,
      fee_amount: form.fee_enabled && form.fee_amount !== '' ? Number(form.fee_amount) : null,
      fee_day: form.fee_enabled && form.fee_day !== '' ? Number(form.fee_day) : null,
      fee_month: form.fee_enabled && form.fee_type === 'annual' && form.fee_month !== '' ? Number(form.fee_month) : null,
      reminder_days: form.fee_enabled && form.reminder_days !== '' ? Number(form.reminder_days) : 7
    }
    const res = editing
      ? await supabase.from('accounts').update(payload).eq('id', editing.id)
      : await supabase.from('accounts').insert({ ...payload, user_id: user.id })

    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    setModalOpen(false)
    reload()
    showToast(editing ? 'Cuenta actualizada.' : 'Cuenta creada.', '✅')
  }

  const handleDelete = async (a) => {
    if (!confirm(`¿Eliminar la cuenta "${a.name}"? Las transacciones asociadas también se eliminarán.`)) return
    const { error } = await supabase.from('transactions').delete().eq('account_id', a.id)
    if (error) { alert(error.message); return }
    const res = await supabase.from('accounts').delete().eq('id', a.id)
    if (res.error) alert(res.error.message)
    else {
      reload()
      showToast('Cuenta eliminada.', '🗑️')
    }
  }

  const isCreditForm = form.type === 'credito'

  if (loading) return <Loader />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Cuentas y tarjetas</h2>
          <p className="muted">
            Disponible: <strong className="text-success">{formatMoney(disponible)}</strong>
            {' · '}Deuda: <strong className="text-danger">{formatMoney(deuda)}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Nueva cuenta
        </button>
      </div>

      {withBalances.length === 0 ? (
        <div className="empty-state card">
          <Wallet size={34} className="muted" />
          <p className="muted">Crea tu primera cuenta o tarjeta para empezar a registrar movimientos.</p>
          <button className="btn btn-primary" onClick={openCreate}>Crear cuenta</button>
        </div>
      ) : (
        <div className="account-grid">
          {withBalances.map((a) => (
            <div
              key={a.id}
              className={`card account-card${isCredit(a) ? ' credit' : ''}${a.balance < 0 ? ' negative' : ''}`}
            >
              <div className="account-card-head">
                {a.bank && bankByCode(a.bank) ? (
                  <span className="bank-badge" style={bankBadgeStyle(a.bank)}>{bankByCode(a.bank).short}</span>
                ) : (
                  <span className="account-card-icon">{accountIcon(a)}</span>
                )}
                <div>
                  <h3>{a.name}</h3>
                  <small className="muted">{accountTypeLabel(a.type)}</small>
                </div>
                <div className="row-actions">
                  <button className="icon-btn" onClick={() => openEdit(a)} aria-label="Editar"><Pencil size={15} /></button>
                  <button className="icon-btn danger" onClick={() => handleDelete(a)} aria-label="Eliminar"><Trash2 size={15} /></button>
                </div>
              </div>

              {isCredit(a) ? (
                <>
                  <div className="account-debt">{formatMoney(a.display)}</div>
                  <small className="muted">Deuda neta</small>
                  <div className="account-meta">
                    {a.credit_limit > 0 && <span className="cat-pill" style={{ background: '#fef3c7', color: '#b45309' }}>Límite {formatMoney(a.credit_limit)}</span>}
                    {a.cut_day && <span className="cat-pill" style={{ background: '#e0e7ff', color: '#4338ca' }}>Corte día {a.cut_day}</span>}
                    {a.pay_day && <span className="cat-pill" style={{ background: '#d1fae5', color: '#047857' }}>Pago día {a.pay_day}</span>}
                    {a.fee_type && (
                      <span className="cat-pill" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                        ⏰ Comisión {a.fee_type === 'annual' ? 'anual' : 'mensual'}: {formatMoney(a.fee_amount || 0)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className={`account-balance${a.balance < 0 ? ' text-danger' : ''}`}>{formatMoney(a.balance)}</div>
                  <small className="muted">Saldo disponible</small>
                  {Number(a.interest_rate) > 0 && (
                    <div className="account-meta">
                      <span className="cat-pill" style={{ background: '#d1fae5', color: '#047857' }}>Rendimiento {a.interest_rate}% APR</span>
                    </div>
                  )}
                </>
              )}

              {a.description && <p className="muted small">{a.description}</p>}
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <h3>Tipos de cuenta</h3>
        <div className="legend-list">
          {ACCOUNT_TYPES.map((t) => (
            <div key={t.value} className="legend-item">
              <span className={`account-type-dot type-${t.value}`} />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" form="account-form" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="account-form" onSubmit={handleSave}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="acc-name">Nombre</label>
            <input id="acc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Cajita Nu, BBVA Débito, Santander LikeU..." required />
          </div>
          <div className="field">
            <label htmlFor="acc-type">Tipo</label>
            <select id="acc-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Icono de la cuenta o tarjeta</label>
            <div className="icon-picker">
              {ACCOUNT_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  className={`icon-pick${form.icon === ic ? ' active' : ''}`}
                  onClick={() => setForm({ ...form, icon: ic })}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Banco / emisor (opcional)</label>
            <div className="bank-picker">
              {BANKS.map((b) => (
                <button
                  key={b.code}
                  type="button"
                  className={`bank-pick${form.bank === b.code ? ' active' : ''}`}
                  style={b.code !== 'none' ? { background: b.color, color: '#ffffff' } : undefined}
                  onClick={() => setForm({ ...form, bank: b.code })}
                  title={b.name}
                >
                  {b.short}
                </button>
              ))}
            </div>
            <small className="muted">Se mostrará como insignia con los colores del banco en lugar del emoji.</small>
          </div>

          {isCreditForm ? (
            <div className="credit-fields">
              <div className="form-row">
                <div className="field">
                  <label htmlFor="acc-limit">Límite de crédito</label>
                  <input id="acc-limit" type="number" min="0" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} placeholder="0.00" />
                </div>
                <div className="field">
                  <label htmlFor="acc-debt-init">Deuda inicial</label>
                  <input id="acc-debt-init" type="number" min="0" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="acc-cut">Día de corte</label>
                  <input id="acc-cut" type="number" min="1" max="31" value={form.cut_day} onChange={(e) => setForm({ ...form, cut_day: e.target.value })} placeholder="Ej. 15" />
                </div>
                <div className="field">
                  <label htmlFor="acc-pay">Día de pago</label>
                  <input id="acc-pay" type="number" min="1" max="31" value={form.pay_day} onChange={(e) => setForm({ ...form, pay_day: e.target.value })} placeholder="Ej. 5" />
                </div>
              </div>

              <div className="field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.fee_enabled}
                    onChange={(e) => setForm({ ...form, fee_enabled: e.target.checked })}
                  />
                  Recordarme la comisión de la tarjeta (mensual o anual)
                </label>
              </div>

              {form.fee_enabled && (
                <div className="credit-fields fee-fields">
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="acc-fee-type">Tipo de comisión</label>
                      <select id="acc-fee-type" value={form.fee_type} onChange={(e) => setForm({ ...form, fee_type: e.target.value })}>
                        <option value="annual">Anual</option>
                        <option value="monthly">Mensual</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="acc-fee-amount">Monto de la comisión</label>
                      <input id="acc-fee-amount" type="number" min="0" value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="form-row">
                    {form.fee_type === 'annual' ? (
                      <div className="field">
                        <label htmlFor="acc-fee-month">Mes de cobro</label>
                        <select id="acc-fee-month" value={form.fee_month} onChange={(e) => setForm({ ...form, fee_month: e.target.value })}>
                          <option value="">Selecciona mes...</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="field" />
                    )}
                    <div className="field">
                      <label htmlFor="acc-fee-day">Día de cobro</label>
                      <input id="acc-fee-day" type="number" min="1" max="31" value={form.fee_day} onChange={(e) => setForm({ ...form, fee_day: e.target.value })} placeholder="Ej. 20" />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="acc-reminder-days">Anticipación del recordatorio (días)</label>
                    <input id="acc-reminder-days" type="number" min="0" max="60" value={form.reminder_days} onChange={(e) => setForm({ ...form, reminder_days: e.target.value })} />
                    <small className="muted">Recibirás alertas en la app este número de días antes del cobro.</small>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="debit-fields">
              <div className="form-row">
                <div className="field">
                  <label htmlFor="acc-init">Saldo inicial</label>
                  <input id="acc-init" type="number" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} placeholder="0.00" />
                </div>
                <div className="field">
                  <label htmlFor="acc-rate">Tasa anual (% APR)</label>
                  <input id="acc-rate" type="number" step="0.1" min="0" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} placeholder="Ej. 13.5" />
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="acc-desc">Descripción (opcional)</label>
            <input id="acc-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notas, banco, número..." />
          </div>
        </form>
      </Modal>
    </div>
  )
}