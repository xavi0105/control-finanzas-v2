import dayjs from 'dayjs'

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadBlob(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function transactionsToCSV(transactions, categories, accounts) {
  const rows = [
    ['Fecha', 'Tipo', 'Descripcion', 'Categoria', 'Cuenta', 'Monto'].join(','),
    ...transactions.map((t) => {
      const cat = categories.find((c) => c.id === t.category_id)?.name || ''
      const acc = accounts.find((a) => a.id === t.account_id)?.name || ''
      const amount = (t.type === 'expense' ? -1 : 1) * Number(t.amount)
      return [dayjs(t.date).format('YYYY-MM-DD'), t.type, t.description || '', cat, acc, amount.toFixed(2)].map(csvEscape).join(',')
    })
  ]
  return rows.join('\n')
}

export function dataToJSON(data) {
  return JSON.stringify(data, null, 2)
}