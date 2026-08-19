import dayjs from 'dayjs'

export function nextFeeDate(account, from = dayjs()) {
  if (!account.fee_type || !account.fee_day) return null
  const day = Number(account.fee_day)
  if (account.fee_type === 'monthly') {
    let d = from.date(day)
    if (d.isBefore(from, 'day')) d = d.add(1, 'month')
    return d
  }
  const month = Number(account.fee_month) || 1
  let d = from.month(month - 1).date(day)
  if (d.isBefore(from, 'day')) d = d.add(1, 'year')
  return d
}

export function feeReminders(accounts, from = dayjs()) {
  return accounts
    .filter((a) => a.fee_type && a.fee_day)
    .map((a) => {
      const due = nextFeeDate(a, from)
      const advance = Number(a.reminder_days ?? 7)
      const dueInDays = due.diff(from, 'day')
      return { account: a, due, advance, dueInDays }
    })
    .filter((r) => r.dueInDays >= 0 && r.dueInDays <= r.advance)
    .sort((x, y) => x.dueInDays - y.dueInDays)
}

export function feeReminderText(r, formatMoney) {
  const { account, due, dueInDays } = r
  const label = account.fee_type === 'annual' ? 'comisión anual' : 'comisión mensual'
  const when = dueInDays === 0 ? 'hoy' : `en ${dueInDays} día(s)`
  return `La ${label} de "${account.name}" (${formatMoney(account.fee_amount)}) se cobra el ${due.format('DD/MM/YYYY')} (${when}).`
}