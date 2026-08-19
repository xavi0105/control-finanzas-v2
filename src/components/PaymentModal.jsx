import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import Modal from './Modal'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { isCredit } from '../utils/format'

export default function PaymentModal({
  open,
  onClose,
  onPaid,
  accounts,
  categories,
  title = 'Registrar pago',
  defaultDescription = '',
  defaultAmount = '',
  defaultAccountId = '',
  defaultCategoryId = ''
}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    account_id: '',
    amount: '',
    category_id: '',
    description: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const debitAccount = accounts.find((a) => !isCredit(a))
    setForm({
      date: dayjs().format('YYYY-MM-DD'),
      account_id: defaultAccountId || debitAccount?.id || '',
      amount: defaultAmount === '' || defaultAmount === null || defaultAmount === undefined ? '' : String(defaultAmount),
      category_id: defaultCategoryId || '',
      description: defaultDescription || ''
    })
    setError('')
    setSaving(false)
  }, [open, accounts, defaultAccountId, defaultAmount, defaultCategoryId, defaultDescription])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.amount || Number(form.amount) <= 0) { setError('Ingresa un monto mayor a 0'); return }
    if (!form.account_id) { setError('Selecciona la cuenta desde la que pagaste'); return }
    if (!form.date) { setError('Selecciona la fecha del pago'); return }

    setSaving(true)
    const res = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: form.account_id,
      category_id: form.category_id || null,
      type: 'expense',
      amount: Number(form.amount),
      description: form.description.trim() || 'Pago',
      date: form.date
    })
    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    onClose()
    showToast('Pago registrado y descontado de la cuenta.', '✅')
    if (onPaid) onPaid()
  }

  const debitAccounts = accounts.filter((a) => !isCredit(a))
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="payment-form" type="submit" disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar pago'}
          </button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-row">
          <div className="field">
            <label htmlFor="pay-date">Fecha en que se pagó</label>
            <input
              id="pay-date"
              type="date"
              value={form.date}
              max={dayjs().format('YYYY-MM-DD')}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pay-amount">Monto pagado</label>
            <input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="pay-acc">Cuenta desde la que pagaste</label>
          <select id="pay-acc" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
            <option value="">Selecciona...</option>
            {debitAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <small className="muted">El pago se descuenta de esta cuenta como gasto.</small>
        </div>

        <div className="field">
          <label htmlFor="pay-cat">Categoría (opcional)</label>
          <select id="pay-cat" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Sin categoría</option>
            {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="pay-desc">Descripción</label>
          <input
            id="pay-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Concepto del pago"
          />
        </div>
      </form>
    </Modal>
  )
}