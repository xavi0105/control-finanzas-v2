import { useMemo, useState } from 'react'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { formatMoney, computeBalance, isCredit, getCurrency } from '../utils/format'
import Loader from '../components/Loader'
import dayjs from 'dayjs'

const CATEGORY_CASHBACK = {
  general: { label: '🛒 General / Súper / Tiendas', rate: 0 },
  gasolina: { label: '⛽ Gasolina', rate: 0.04 },
  farmacia: { label: '💊 Farmacia / Salud', rate: 0.06 },
  servicios: { label: '⚡ Servicios fijos / Recibos', rate: 0 },
  restaurante: { label: '🍽️ Restaurantes y comida', rate: 0 }
}

export default function Recommender() {
  const { accounts, transactions, loading } = useFinance()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [fecha, setFecha] = useState(dayjs().format('YYYY-MM-DD'))
  const [categoria, setCategoria] = useState('general')
  const [monto, setMonto] = useState(1850)
  const [tipoPago, setTipoPago] = useState('contado')

  const currency = getCurrency()

  const cashbackAccounts = useMemo(
    () => accounts.filter((a) => isCredit(a) && /santander|likeu/i.test(a.name)),
    [accounts]
  )

  const evalResult = useMemo(() => {
    if (!accounts.length || !monto) return null
    const m = Number(monto)
    const actives = accounts.filter((a) => !isCredit(a) || a.credit_limit > 0)

    let best = null
    let bestScore = -Infinity
    let bestReason = ''
    let bestBenefit = 0
    let bestDays = 0

    for (const acc of actives) {
      let score = 0
      let reason = ''
      let benefit = 0
      let days = 0
      const balance = computeBalance(acc, transactions)

      if (isCredit(acc)) {
        const cut = acc.cut_day || 15
        const pay = acc.pay_day || 5
        const buyDate = new Date(fecha)
        let nextCut = new Date(buyDate.getFullYear(), buyDate.getMonth(), cut)
        if (buyDate > nextCut) nextCut.setMonth(nextCut.getMonth() + 1)
        let nextPay = new Date(nextCut.getFullYear(), nextCut.getMonth(), pay)
        if (nextPay <= nextCut) nextPay.setMonth(nextPay.getMonth() + 1)
        days = Math.ceil(Math.abs(nextPay - buyDate) / 86400000)
        score += days * 1.5
        reason = `Compra post-corte (día ${cut}). Aprox. ${days} días de financiamiento.`

        if (cashbackAccounts.some((c) => c.id === acc.id)) {
          const rate = CATEGORY_CASHBACK[categoria]?.rate || 0
          if (rate > 0) {
            benefit = m * rate
            score += rate * 1500
            reason += ` ¡Cashback ${rate * 100}% ${CATEGORY_CASHBACK[categoria].label.split(' ')[1]}!`
          }
        }

        const debt = Math.max(0, -balance)
        const limit = Number(acc.credit_limit || 0)
        const usage = limit > 0 ? (debt + m) / limit : 0
        if (usage > 0.9) { score -= 500; reason += ' Alerta: superaría el 90% de tu línea.' }
        else if (usage > 0.5) score -= 80
      } else {
        score += 10
        reason = `Cuenta ${acc.name}. Gasta liquidez sin comisiones ni endeudamiento.`
        benefit = (m * (Number(acc.interest_rate) || 0)) / 100 / 12
        if (balance < m) { score -= 200; reason += ' Saldo insuficiente, revisa tu liquidez.' }
      }

      if (score > bestScore) {
        bestScore = score
        best = acc
        bestReason = reason
        bestBenefit = benefit
        bestDays = days
      }
    }

    return { account: best, reason: bestReason, benefit: bestBenefit, days: bestDays }
  }, [accounts, transactions, fecha, categoria, monto, cashbackAccounts])

  const registrarSugerencia = async () => {
    if (!evalResult?.account) return
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: evalResult.account.id,
      type: 'expense',
      amount: Number(monto),
      description: `Compra sugerida (${CATEGORY_CASHBACK[categoria].label.split(' ').slice(1).join(' ')})`,
      date: fecha
    })
    if (error) { showToast(error.message, '❌'); return }
    showToast('Compra registrada en la cuenta recomendada.', '✅')
  }

  if (loading) return <Loader />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>💡 Recomendador</h2>
          <p className="muted">Evalúa en tiempo real qué cuenta te conviene para cada compra.</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Evaluación de compra en tiempo real</h3>
          <p className="muted small">El algoritmo prioriza financiamiento, cashback y tu liquidez disponible.</p>
          <div className="field">
            <label>Fecha prevista de compra</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="field">
            <label>Categoría del gasto</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {Object.entries(CATEGORY_CASHBACK).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Monto de la compra ({currency})</label>
            <input type="number" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
          </div>
          <div className="field">
            <label>Modalidad</label>
            <div className="type-toggle">
              <button className={tipoPago === 'contado' ? 'active income' : ''} onClick={() => setTipoPago('contado')}>Contado</button>
              <button className={tipoPago === 'msi' ? 'active expense' : ''} onClick={() => setTipoPago('msi')}>Meses sin intereses</button>
            </div>
          </div>
        </section>

        <section className="card dark-hero">
          {evalResult && evalResult.account ? (
            <>
              <div className="hero-top">
                <span className="hero-badge">⭐ Recomendación óptima</span>
                <span className="hero-badge green">
                  {isCredit(evalResult.account)
                    ? `${evalResult.days} días de financiamiento`
                    : 'Pago con liquidez'}
                </span>
              </div>
              <h3 className="hero-title">{evalResult.account.name}</h3>
              <p className="hero-reason">{evalResult.reason}</p>
              <div className="hero-grid">
                <div>
                  <p className="hero-label">Día de corte próximo</p>
                  <p className="hero-value">{isCredit(evalResult.account) ? `Día ${evalResult.account.cut_day || '—'}` : 'N/A'}</p>
                </div>
                <div>
                  <p className="hero-label">Fecha límite de pago</p>
                  <p className="hero-value">{isCredit(evalResult.account) ? `Día ${evalResult.account.pay_day || '—'}` : 'Inmediato'}</p>
                </div>
              </div>
              <div className="hero-benefit">
                <p>💰 Beneficio estimado (cashback + rendimiento)</p>
                <strong>{formatMoney(evalResult.benefit)}</strong>
              </div>
              <button className="btn btn-hero" onClick={registrarSugerencia}>Registrar esta compra</button>
            </>
          ) : (
            <div className="hero-empty">Registra cuentas para obtener una recomendación.</div>
          )}
        </section>
      </div>
    </div>
  )
}