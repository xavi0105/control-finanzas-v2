const CURRENCIES = {
  MXN: { symbol: '$', decimals: 2 },
  USD: { symbol: 'US$', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
  COP: { symbol: '$', decimals: 0 },
  ARS: { symbol: '$', decimals: 2 },
  CLP: { symbol: '$', decimals: 0 }
}

export function getCurrency() {
  const stored = localStorage.getItem('cf_currency')
  return stored && CURRENCIES[stored] ? stored : 'MXN'
}

export function setCurrency(code) {
  localStorage.setItem('cf_currency', code)
}

export function formatMoney(amount, currency = getCurrency()) {
  const conf = CURRENCIES[currency] || CURRENCIES.MXN
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: conf.decimals,
    maximumFractionDigits: conf.decimals
  }).format(Number(amount) || 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(dateStr))
}

export function formatMonth(dateStr) {
  return new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(new Date(dateStr))
}

export const ACCOUNT_TYPES = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'bancaria', label: 'Bancaria' },
  { value: 'credito', label: 'Tarjeta de crédito' },
  { value: 'ahorro', label: 'Ahorro / Cajita' },
  { value: 'otro', label: 'Otra' }
]

export function accountTypeLabel(value) {
  const t = ACCOUNT_TYPES.find((x) => x.value === value)
  return t ? t.label : value
}

export function isCredit(account) {
  return account?.type === 'credito'
}

// Saldo con signo: positivo = dinero disponible (débito), negativo = deuda (crédito)
export function computeBalance(account, transactions) {
  let balance = Number(account?.initial_balance || 0)
  for (const t of transactions) {
    if (t.account_id === account?.id) {
      balance += (t.type === 'income' ? 1 : -1) * Number(t.amount)
    }
  }
  return balance
}

// Para cuentas de crédito devuelve la deuda (número positivo)
export function accountBalanceDisplay(account, transactions) {
  const b = computeBalance(account, transactions)
  if (isCredit(account)) return Math.max(0, -b)
  return b
}

export const TYPE_LABELS = {
  income: 'Ingreso',
  expense: 'Gasto'
}