import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import dayjs from 'dayjs'
import { useFinance } from '../context/FinanceContext'
import { formatMoney, formatMonth, getCurrency, computeBalance } from '../utils/format'
import { monthKey, budgetProgress } from '../utils/budget'
import Loader from '../components/Loader'

const PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#22c55e', '#eab308', '#06b6d4']

export default function Reports() {
  const { transactions, categories, budgets, accounts, loading } = useFinance()
  const currency = getCurrency()
  const [monthsBack, setMonthsBack] = useState(12)
  const [year, setYear] = useState(dayjs().year())

  const range = useMemo(() => {
    const months = []
    for (let i = monthsBack - 1; i >= 0; i--) {
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
  }, [transactions, monthsBack])

  const yearTotals = useMemo(() => {
    const income = {}, expense = {}
    for (const t of transactions) {
      if (dayjs(t.date).year() !== year) continue
      const catId = t.category_id
      if (t.type === 'income') income[catId] = (income[catId] || 0) + Number(t.amount)
      else expense[catId] = (expense[catId] || 0) + Number(t.amount)
    }
    const catName = (id) => categories.find((c) => c.id === id)?.name || 'Sin categoría'
    const catColor = (id) => categories.find((c) => c.id === id)?.color || '#94a3b8'
    return {
      incomePie: Object.entries(income).map(([id, value]) => ({ name: catName(id), value, color: catColor(id) })).sort((a, b) => b.value - a.value),
      expensePie: Object.entries(expense).map(([id, value]) => ({ name: catName(id), value, color: catColor(id) })).sort((a, b) => b.value - a.value),
      totalIncome: Object.values(income).reduce((s, v) => s + v, 0),
      totalExpense: Object.values(expense).reduce((s, v) => s + v, 0)
    }
  }, [transactions, categories, year])

  const yearsAvailable = useMemo(() => {
    const set = new Set(transactions.map((t) => dayjs(t.date).year()))
    set.add(dayjs().year())
    return [...set].sort((a, b) => b - a)
  }, [transactions])

  const categoriesExpenseByYear = useMemo(() => {
    const catYear = {}
    for (const t of transactions) {
      const y = dayjs(t.date).year()
      if (t.type !== 'expense') continue
      catYear[y] = (catYear[y] || 0) + Number(t.amount)
    }
    return Object.entries(catYear).sort((a, b) => b[0] - a[0])
  }, [transactions])

  const catSummary = useMemo(() => {
    const map = {}
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      const catId = t.category_id
      map[catId] = (map[catId] || 0) + Number(t.amount)
    }
    return Object.entries(map)
      .map(([id, value]) => ({
        id,
        name: categories.find((c) => c.id === id)?.name || 'Sin categoría',
        value,
        color: categories.find((c) => c.id === id)?.color || '#94a3b8'
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, categories])

  const totalExpenseAll = catSummary.reduce((s, c) => s + c.value, 0)

  const metrics = useMemo(() => {
    let neto = 0
    for (const acc of accounts) {
      neto += computeBalance(acc, transactions)
    }
    return { neto }
  }, [accounts, transactions])

  const projection = useMemo(() => {
    const baseMonths = 3
    const keys = []
    for (let i = 1; i <= baseMonths; i++) {
      keys.push(dayjs().subtract(i, 'month').format('YYYY-MM'))
    }
    let avgIncome = 0
    let avgExpense = 0
    for (const t of transactions) {
      if (!keys.includes(monthKey(t.date))) continue
      if (t.type === 'income') avgIncome += Number(t.amount)
      else avgExpense += Number(t.amount)
    }
    avgIncome /= baseMonths
    avgExpense /= baseMonths

    let running = metrics.neto
    const months = []
    for (let i = 1; i <= 12; i++) {
      const d = dayjs().add(i, 'month')
      running += avgIncome - avgExpense
      months.push({ label: formatMonth(d.toDate()), projected: Math.round(running) })
    }
    return { avgIncome, avgExpense, months }
  }, [transactions, metrics])

  const budgetComparison = useMemo(() => {
    const thisM = dayjs().format('YYYY-MM')
    return budgets.map((b) => {
      const cat = categories.find((c) => c.id === b.category_id)
      const prog = budgetProgress(budgets, transactions, b.category_id, thisM)
      return {
        name: cat?.name || 'Sin categoría',
        color: cat?.color || '#94a3b8',
        presupuesto: Number(b.amount),
        real: prog?.spent || 0,
        exceeded: prog?.exceeded || false
      }
    }).sort((a, b) => b.presupuesto - a.presupuesto)
  }, [budgets, categories, transactions])

  if (loading) return <Loader />

  const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Reportes</h2>
          <p className="muted">Analiza tus ingresos y gastos</p>
        </div>
        <div className="filter-buttons">
          {[6, 12, 24].map((n) => (
            <button key={n} className={`btn btn-sm ${monthsBack === n ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMonthsBack(n)}>
              {n} meses
            </button>
          ))}
        </div>
      </div>

      <section className="card">
        <h3>Evolución de ingresos y gastos</h3>
        <div className="chart-box tall">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={range} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} width={45} />
              <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Ingresos" stroke="var(--green)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expense" name="Gastos" stroke="var(--red)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" name="Neto" stroke="var(--blue)" strokeWidth={2} dot={false} strokeDasharray="5 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Flujo de caja proyectado (12 meses)</h3>
          <span className="muted small">Basado en tu saldo neto y el promedio de los últimos 3 meses</span>
        </div>
        <div className="stat-list compact">
          <div className="stat-row"><span>Saldo neto actual</span><strong>{formatMoney(metrics.neto)}</strong></div>
          <div className="stat-row"><span>Ingreso mensual promedio</span><strong className="text-success">{formatMoney(projection.avgIncome)}</strong></div>
          <div className="stat-row"><span>Gasto mensual promedio</span><strong className="text-danger">{formatMoney(projection.avgExpense)}</strong></div>
          <div className="stat-row total">
            <span>Ahorro proyectado mensual</span>
            <strong>{formatMoney(projection.avgIncome - projection.avgExpense)}</strong>
          </div>
        </div>
        <div className="chart-box tall">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection.months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} width={45} />
              <Tooltip formatter={(v) => formatMoney(v, currency)} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="projected" name="Saldo proyectado" stroke="var(--indigo-600)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {budgetComparison.length > 0 && (
        <section className="card">
          <h3>Presupuesto vs real ({formatMonth(dayjs().toDate())})</h3>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={budgetComparison} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} width={45} />
                <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="presupuesto" name="Presupuesto" fill="var(--indigo-600)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="real" name="Real" radius={[4, 4, 0, 0]}>
                  {budgetComparison.map((b, i) => (
                    <Cell key={i} fill={b.exceeded ? 'var(--red)' : 'var(--green)'} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="grid-2">
        <section className="card">
          <h3>Ingresos y gastos por mes</h3>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={range} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} interval={monthsBack > 12 ? 1 : 0} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} width={45} />
                <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="income" name="Ingresos" fill="var(--green)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Gastos" fill="var(--red)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <h3>Gastos por categoría ({year})</h3>
          <div className="year-select">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {yearTotals.expensePie.length === 0 ? (
            <p className="muted">Sin gastos registrados en {year}.</p>
          ) : (
            <div className="pie-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={yearTotals.expensePie} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={3}>
                    {yearTotals.expensePie.map((entry, i) => (
                      <Cell key={i} fill={entry.color || PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="legend-list compact">
            {yearTotals.expensePie.slice(0, 6).map((c) => (
              <div key={c.name} className="legend-item">
                <span className="legend-color" style={{ background: c.color || '#94a3b8' }} />
                <span>{c.name}</span>
                <strong>{formatMoney(c.value)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Resumen anual</h3>
          <div className="year-select">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="stat-list">
            <div className="stat-row"><span>Ingresos</span><strong className="text-success">{formatMoney(yearTotals.totalIncome)}</strong></div>
            <div className="stat-row"><span>Gastos</span><strong className="text-danger">{formatMoney(yearTotals.totalExpense)}</strong></div>
            <div className="stat-row total"><span>Resultado</span><strong>{formatMoney(yearTotals.totalIncome - yearTotals.totalExpense)}</strong></div>
          </div>
        </section>

        <section className="card">
          <h3>Gastos por año</h3>
          <div className="bar-list">
            {categoriesExpenseByYear.map(([y, total]) => (
              <div key={y} className="bar-row">
                <span className="bar-label">{y}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(total / Math.max(...categoriesExpenseByYear.map(([, t]) => t))) * 100}%` }}
                  />
                </div>
                <strong>{formatMoney(total)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <h3>Desglose de gastos por categoría (todo el historial)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th className="align-right">Monto</th>
                <th className="align-right">% del total</th>
              </tr>
            </thead>
            <tbody>
              {catSummary.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="cat-pill" style={{ background: `${c.color}22`, color: c.color }}>{c.name}</span>
                  </td>
                  <td className="align-right">{formatMoney(c.value)}</td>
                  <td className="align-right muted">{totalExpenseAll ? ((c.value / totalExpenseAll) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}