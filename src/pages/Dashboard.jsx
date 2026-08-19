import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CalendarClock } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import dayjs from 'dayjs'
import { useFinance } from '../context/FinanceContext'
import { formatMoney, computeBalance, isCredit, getCurrency, formatMonth, formatDate } from '../utils/format'
import { monthKey, budgetProgress } from '../utils/budget'
import { feeReminders, feeReminderText } from '../utils/fees'
import { upcomingWithin, frequencyLabel } from '../utils/planned'
import Loader from '../components/Loader'
import StatCard from '../components/StatCard'

function deltaPct(current, previous) {
  if (!previous || previous === 0) return current === 0 ? null : null
  return Math.round(((current - previous) / previous) * 100)
}

export default function Dashboard() {
  const { accounts, categories, transactions, goals, budgets, plannedExpenses, loading } = useFinance()
  const currency = getCurrency()
  const now = dayjs()
  const thisMonth = now.format('YYYY-MM')
  const prevMonth = now.subtract(1, 'month').format('YYYY-MM')

  const metrics = useMemo(() => {
    let disponible = 0
    let deuda = 0
    let limiteTotal = 0
    const month = { cur: { income: 0, expense: 0 }, prev: { income: 0, expense: 0 } }

    for (const acc of accounts) {
      const b = computeBalance(acc, transactions)
      if (isCredit(acc)) {
        deuda += Math.max(0, -b)
        limiteTotal += Number(acc.credit_limit || 0)
      } else {
        disponible += b
      }
    }
    for (const t of transactions) {
      const key = monthKey(t.date)
      if (key === thisMonth) {
        if (t.type === 'income') month.cur.income += Number(t.amount)
        else month.cur.expense += Number(t.amount)
      } else if (key === prevMonth) {
        if (t.type === 'income') month.prev.income += Number(t.amount)
        else month.prev.expense += Number(t.amount)
      }
    }
    const neto = disponible - deuda
    const uso = limiteTotal > 0 ? (deuda / limiteTotal) * 100 : 0
    return { disponible, deuda, neto, uso, ...month }
  }, [accounts, transactions, thisMonth, prevMonth])

  const coach = useMemo(() => {
    const ratio = metrics.cur.income > 0 ? metrics.cur.expense / metrics.cur.income : metrics.cur.expense > 0 ? Infinity : 0
    if (metrics.cur.income === 0 && metrics.cur.expense === 0) {
      return {
        icon: '🤖',
        text: 'Registra tus ingresos y gastos para que tu coach financiero analice tus patrones y te sugiera cómo ahorrar.'
      }
    }
    if (ratio > 0.75) {
      return {
        icon: '⚠️',
        text: (
          <>
            <b>Precaución:</b> tus gastos del mes ({formatMoney(metrics.cur.expense)}) representan más del 75% de tus ingresos ({formatMoney(metrics.cur.income)}). Reduce gastos en categorías variables para evitar déficit antes de la siguiente entrada de dinero.
          </>
        )
      }
    }
    return {
      icon: '✅',
      text: (
        <>
          <b>Estable:</b> tus gastos del mes ({formatMoney(metrics.cur.expense)}) están en rango seguro frente a tus ingresos ({formatMoney(metrics.cur.income)}). Continúa así para fortalecer tus metas de ahorro.
        </>
      )
    }
  }, [metrics])

  const trend = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = dayjs().subtract(i, 'month')
      months.push({ key: d.format('YYYY-MM'), label: formatMonth(d.toDate()), income: 0, expense: 0, net: 0 })
    }
    const map = Object.fromEntries(months.map((m) => [m.key, m]))
    for (const t of transactions) {
      const m = map[monthKey(t.date)]
      if (!m) continue
      if (t.type === 'income') m.income += Number(t.amount)
      else m.expense += Number(t.amount)
      m.net = m.income - m.expense
    }
    return months
  }, [transactions])

  const notifications = useMemo(() => {
    const list = []

    for (const b of budgets) {
      const cat = categories.find((c) => c.id === b.category_id)
      const prog = budgetProgress(budgets, transactions, b.category_id, thisMonth)
      if (prog?.exceeded && cat) {
        list.push({ type: 'danger', text: `Presupuesto excedido en "${cat.name}": gastaste ${formatMoney(prog.spent)} de ${formatMoney(b.amount)}.` })
      } else if (prog && cat && prog.pct >= 80) {
        list.push({ type: 'warn', text: `Presupuesto casi agotado en "${cat.name}" (${prog.pct}% usado).` })
      }
    }

    for (const g of goals) {
      if (g.deadline) {
        const days = dayjs(g.deadline).diff(dayjs(), 'day')
        const pct = Number(g.target_amount) > 0 ? (Number(g.saved_amount) / Number(g.target_amount)) * 100 : 0
        if (days >= 0 && days <= 30 && pct < 90) {
          list.push({ type: 'warn', text: `Meta "${g.name}" vence en ${days} día(s) y llevas ${Math.round(pct)}% del objetivo.` })
        }
      }
    }

    for (const acc of accounts) {
      if (isCredit(acc)) {
        const balance = computeBalance(acc, transactions)
        const debt = Math.max(0, -balance)
        const limit = Number(acc.credit_limit || 0)
        if (limit > 0 && debt / limit > 0.5) {
          list.push({ type: 'warn', text: `Tarjeta "${acc.name}" usa ${Math.round((debt / limit) * 100)}% de su línea de crédito.` })
        }
        if (acc.pay_day) {
          const payDay = dayjs().date(acc.pay_day)
          const diff = payDay.diff(dayjs(), 'day')
          if (diff >= -3 && diff <= 7) {
            list.push({ type: 'info', text: `Fecha límite de pago de "${acc.name}" (día ${acc.pay_day}) está cerca${diff < 0 ? ' (venció)' : ` en ${diff} día(s)`}.` })
          }
        }
      } else if (computeBalance(acc, transactions) < 0) {
        list.push({ type: 'danger', text: `La cuenta "${acc.name}" tiene saldo negativo.` })
      }
    }

    for (const r of feeReminders(accounts)) {
      list.push({ type: 'warn', text: feeReminderText(r, formatMoney) })
    }

    for (const e of upcomingWithin(plannedExpenses, 3)) {
      const when = e.dueInDays === 0 ? 'HOY' : `en ${e.dueInDays} día(s)`
      list.push({ type: 'info', text: `Pago programado de "${e.name}" (${formatMoney(e.amount)}) vence ${when}.` })
    }

    return list
  }, [budgets, categories, transactions, goals, accounts, thisMonth, plannedExpenses])

  const recent = transactions.slice(0, 6)
  const totalGoals = goals.reduce((s, g) => s + Number(g.saved_amount), 0)
  const incomeDelta = deltaPct(metrics.cur.income, metrics.prev.income)
  const expenseDelta = deltaPct(metrics.cur.expense, metrics.prev.expense)

  const monthPlanned = useMemo(() => {
    const month = now.format('YYYY-MM')
    const items = plannedExpenses
      .filter((e) => e.active !== false && dayjs(e.next_due).format('YYYY-MM') === month)
      .map((e) => ({ ...e, days: dayjs(e.next_due).diff(now, 'day') }))
      .sort((a, b) => a.days - b.days)
    return {
      items,
      total: items.reduce((s, e) => s + Number(e.amount), 0),
      next: items[0]
    }
  }, [plannedExpenses, now])

  if (loading) return <Loader />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Resumen general</h2>
          <p className="muted">Vista integral de tu liquidez, deuda y hábitos de gasto</p>
        </div>
        <Link to="/transacciones" className="btn btn-primary">
          Nueva transacción <ArrowRight size={16} />
        </Link>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Dinero disponible (débito)"
          value={formatMoney(metrics.disponible)}
          currency={currency}
          badge="Disponible"
          badgeTone="emerald"
          sub="Cajitas + cuentas líquidas"
          up
        />
        <StatCard
          label="Ingresos del mes"
          value={formatMoney(metrics.cur.income)}
          currency={currency}
          badge={incomeDelta != null && incomeDelta > 0 ? `+${incomeDelta}% vs mes ant.` : incomeDelta != null && incomeDelta < 0 ? `${incomeDelta}% vs mes ant.` : 'Este mes'}
          badgeTone={incomeDelta > 0 ? 'emerald' : incomeDelta < 0 ? 'amber' : 'indigo'}
          sub={`Ingresos previos: ${formatMoney(metrics.prev.income)}`}
        />
        <StatCard
          label="Gastos del mes"
          value={formatMoney(metrics.cur.expense)}
          currency={currency}
          badge={expenseDelta != null && expenseDelta > 0 ? `+${expenseDelta}% vs mes ant.` : expenseDelta != null && expenseDelta < 0 ? `${expenseDelta}% vs mes ant.` : 'Este mes'}
          badgeTone={expenseDelta > 0 ? 'rose' : expenseDelta < 0 ? 'emerald' : 'indigo'}
          sub={`Gastos previos: ${formatMoney(metrics.prev.expense)}`}
        />
        <StatCard
          label="Uso de crédito global"
          value={`${metrics.uso.toFixed(1)}%`}
          badge={metrics.uso < 30 ? 'Excelente' : metrics.uso < 60 ? 'Moderado' : 'Alto'}
          badgeTone={metrics.uso < 30 ? 'emerald' : metrics.uso < 60 ? 'amber' : 'rose'}
          sub="Recomendación de buró: menos del 30%"
        />
      </div>

      <div className="coach-alert">
        <div className="coach-icon">{coach.icon}</div>
        <div className="grow">
          <h4 className="coach-title">Alerta inteligente de tu coach financiero</h4>
          <p className="coach-text">{coach.text}</p>
        </div>
      </div>

      {notifications.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3><BellRing size={16} /> Notificaciones ({notifications.length})</h3>
          </div>
          <div className="notif-list">
            {notifications.slice(0, 8).map((n, i) => (
              <div key={i} className={`notif notif-${n.type}`}>
                <span className="notif-dot" />
                <span>{n.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {budgets.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3>Presupuestos del mes</h3>
            <Link to="/reportes" className="link">Ver análisis</Link>
          </div>
          <div className="goals-mini">
            {budgets.slice(0, 6).map((b) => {
              const cat = categories.find((c) => c.id === b.category_id)
              const prog = budgetProgress(budgets, transactions, b.category_id, thisMonth)
              if (!cat || !prog) return null
              const pct = prog.pct
              return (
                <div key={b.id} className="goal-mini">
                  <div className="goal-mini-head">
                    <span style={{ color: cat.color }}>{cat.name}</span>
                    <small className={prog.exceeded ? 'text-danger' : 'muted'}>{prog.exceeded ? 'Excedido' : `${pct}% · ${formatMoney(prog.remaining)}`}</small>
                  </div>
                  <div className="progress">
                    <div className={`progress-bar${prog.exceeded ? ' over' : pct >= 80 ? ' near' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {monthPlanned.items.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3><CalendarClock size={16} /> Gastos planeados del mes</h3>
            <Link to="/gastos" className="link">Gestionar</Link>
          </div>
          <div className="planned-hero">
            <div className="planned-hero-total">
              <small className="muted">Total del mes</small>
              <strong>{formatMoney(monthPlanned.total)}</strong>
              <span className="planned-badge">{monthPlanned.items.length} pagos</span>
            </div>
            <div className="planned-hero-next">
              <small className="muted">Siguiente pago</small>
              <strong>{monthPlanned.next.icon || '🧾'} {monthPlanned.next.name}</strong>
              <span className="planned-countdown">
                {monthPlanned.next.days === 0 ? 'vence HOY' : monthPlanned.next.days === 1 ? 'mañana' : `en ${monthPlanned.next.days} días`}
              </span>
            </div>
          </div>
          <div className="planned-timeline">
            {monthPlanned.items.map((e) => (
              <div key={e.id} className="planned-item">
                <span className="planned-dot">{e.icon || '🧾'}</span>
                <div className="planned-body">
                  <div className="planned-top">
                    <strong>{e.name}</strong>
                    <span className="planned-date">{formatDate(e.next_due)}</span>
                  </div>
                  <div className="planned-bottom">
                    <span className="muted small">{frequencyLabel(e.frequency)}</span>
                    <span className="planned-amount">{formatMoney(e.amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid-2">
        <section className="card">
          <h3>Flujo de los últimos 6 meses</h3>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} width={45} />
                <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }} />
                <Legend />
                <Bar dataKey="income" name="Ingresos" fill="var(--green)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Gastos" fill="var(--red)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="net" name="Neto" stroke="var(--indigo-600)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Cuentas</h3>
            <Link to="/cuentas" className="link">Ver todas</Link>
          </div>
          {accounts.length === 0 ? (
            <EmptyState text="Aún no tienes cuentas." to="/cuentas" />
          ) : (
            <ul className="list">
              {accounts.map((a) => {
                const balance = computeBalance(a, transactions)
                return (
                  <li key={a.id} className="list-item">
                    <div>
                      <strong>{a.name}</strong>
                      <small className="muted">{a.type}</small>
                    </div>
                    {isCredit(a) ? (
                      <span className="text-danger">{formatMoney(Math.max(0, -balance))} deuda</span>
                    ) : (
                      <span className={balance < 0 ? 'text-danger' : ''}>{formatMoney(balance)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Últimas transacciones</h3>
          <Link to="/transacciones" className="link">Ver todas</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState text="Registra tu primera transacción para comenzar." to="/transacciones" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Cuenta</th>
                  <th className="align-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => {
                  const cat = categories.find((c) => c.id === t.category_id)
                  const acc = accounts.find((a) => a.id === t.account_id)
                  return (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{t.description || '—'}</td>
                      <td>
                        {cat && <span className="cat-pill" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.name}</span>}
                      </td>
                      <td className="muted">{acc?.name || '—'}</td>
                      <td className={`align-right amount ${t.type}`}>
                        {t.type === 'income' ? '+' : '−'} {formatMoney(t.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {goals.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3>Metas de ahorro</h3>
            <Link to="/metas" className="link">Ver todas</Link>
          </div>
          <p className="muted">Ahorrado en total: <strong>{formatMoney(totalGoals)}</strong></p>
          <div className="goals-mini">
            {goals.slice(0, 4).map((g) => {
              const pct = Math.min(100, Math.round((Number(g.saved_amount) / Number(g.target_amount)) * 100))
              return (
                <div key={g.id} className="goal-mini">
                  <div className="goal-mini-head">
                    <span>{g.name}</span>
                    <small className="muted">{pct}%</small>
                  </div>
                  <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function EmptyState({ text, to }) {
  return (
    <div className="empty-state">
      <p className="muted">{text}</p>
      <Link to={to} className="btn btn-outline">Ir ahora</Link>
    </div>
  )
}