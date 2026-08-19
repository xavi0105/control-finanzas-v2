export const BANKS = [
  { code: 'none', name: 'Sin banco', short: '?', color: '#94a3b8' },
  { code: 'bbva', name: 'BBVA', short: 'BBVA', color: '#1973b8' },
  { code: 'banamex', name: 'Citibanamex', short: 'B', color: '#c8102e' },
  { code: 'santander', name: 'Santander', short: 'S', color: '#ec0000' },
  { code: 'hsbc', name: 'HSBC', short: 'HSBC', color: '#db0011' },
  { code: 'banorte', name: 'Banorte', short: 'N', color: '#002b5c' },
  { code: 'scotiabank', name: 'Scotiabank', short: 'S', color: '#c41f3e' },
  { code: 'nu', name: 'Nu', short: 'Nu', color: '#820ad1' },
  { code: 'stori', name: 'Stori', short: 'S', color: '#00b3a4' },
  { code: 'klar', name: 'Klar', short: 'K', color: '#0e9f6e' },
  { code: 'mercado-pago', name: 'Mercado Pago', short: 'MP', color: '#009ee3' },
  { code: 'coppel', name: 'Coppel', short: 'C', color: '#00843d' },
  { code: 'bancoppel', name: 'BanCoppel', short: 'BC', color: '#00843d' },
  { code: 'azteca', name: 'Banco Azteca', short: 'AZT', color: '#f26522' },
  { code: 'inbursa', name: 'Inbursa', short: 'I', color: '#00538c' },
  { code: 'amex', name: 'American Express', short: 'AMEX', color: '#2e77bc' },
  { code: 'visa', name: 'Visa', short: 'VISA', color: '#1a1f71' },
  { code: 'mastercard', name: 'Mastercard', short: 'MC', color: '#eb001b' }
]

export function bankByCode(code) {
  if (!code) return null
  return BANKS.find((b) => b.code === code) || null
}

export function bankBadgeStyle(code) {
  const b = bankByCode(code)
  return b ? { background: b.color, color: '#ffffff' } : null
}