import dayjs from 'dayjs'

export const FREQUENCIES = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'bimonthly', label: 'Bimestral' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' }
]

export const EXPENSE_ICONS = [
  '💧', '🔌', '🔥', '💡', '📶', '🏠', '📱', '💳', '📺', '🚌', '🛡️', '🎮', '📚', '🧾', '⚡', '🚗',
  '🛒', '🏥', '💊', '🍔', '☕', '🎓', '✈️', '🎁', '🐾', '🏋️', '💇', '🛠️', '⛽', '📦', '💸', '🏦',
  '🎵', '🍺', '🥤', '💻', '🖥️', '🏫', '👶', '🐈', '🪴', '🎂', '🧹', '🚖', '🅿️', '🗞️', '💈', '🦷'
]

export function frequencyLabel(value) {
  return FREQUENCIES.find((f) => f.value === value)?.label || 'Mensual'
}

export function advanceDue(due, frequency) {
  const d = dayjs(due)
  switch (frequency) {
    case 'weekly': return d.add(7, 'day').format('YYYY-MM-DD')
    case 'biweekly': return d.add(14, 'day').format('YYYY-MM-DD')
    case 'monthly': return d.add(1, 'month').format('YYYY-MM-DD')
    case 'bimonthly': return d.add(2, 'month').format('YYYY-MM-DD')
    case 'quarterly': return d.add(3, 'month').format('YYYY-MM-DD')
    case 'semiannual': return d.add(6, 'month').format('YYYY-MM-DD')
    case 'annual': return d.add(1, 'year').format('YYYY-MM-DD')
    default: return d.add(1, 'month').format('YYYY-MM-DD')
  }
}

export function upcomingWithin(expenses, days, from = dayjs()) {
  const limit = from.add(days, 'day')
  return expenses
    .filter((e) => e.active !== false)
    .map((e) => ({ ...e, due: dayjs(e.next_due), dueInDays: dayjs(e.next_due).diff(from, 'day') }))
    .filter((e) => e.dueInDays >= 0 && e.dueInDays <= days)
    .sort((a, b) => a.dueInDays - b.dueInDays)
}

export function sumUpcoming(expenses, days, from = dayjs()) {
  return upcomingWithin(expenses, days, from).reduce((s, e) => s + Number(e.amount), 0)
}

export function monthlyPlanning(expenses, from = dayjs()) {
  const month = from.format('YYYY-MM')
  const dueThisMonth = expenses
    .filter((e) => e.active !== false && dayjs(e.next_due).format('YYYY-MM') === month)
    .reduce((s, e) => s + Number(e.amount), 0)
  return {
    dueThisMonth,
    weeklySaving: Math.ceil(dueThisMonth / 4.33)
  }
}