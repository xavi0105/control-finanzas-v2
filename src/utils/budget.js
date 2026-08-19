import dayjs from 'dayjs'

export function monthKey(date) {
  return dayjs(date).format('YYYY-MM')
}

export function spentInMonth(transactions, categoryId, month) {
  return transactions.reduce((sum, t) => {
    if (t.type === 'expense' && t.category_id === categoryId && monthKey(t.date) === month) {
      sum += Number(t.amount)
    }
    return sum
  }, 0)
}

export function budgetForCategory(budgets, categoryId) {
  return budgets.find((b) => b.category_id === categoryId) || null
}

export function budgetProgress(budgets, transactions, categoryId, month) {
  const budget = budgetForCategory(budgets, categoryId)
  if (!budget) return null
  const spent = spentInMonth(transactions, categoryId, month)
  const amount = Number(budget.amount)
  return {
    budget,
    spent,
    remaining: amount - spent,
    pct: amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 100,
    exceeded: spent > amount
  }
}