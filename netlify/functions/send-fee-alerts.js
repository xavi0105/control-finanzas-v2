const { createClient } = require('@supabase/supabase-js')

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c])
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Resend no configurado. Agrega RESEND_API_KEY en Netlify.' }) }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Supabase no configurado.' }) }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Body inválido' }) }
  }

  const { accessToken, reminders } = body

  const supabase = createClient(supabaseUrl, supabaseAnon)
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  if (error || !user) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Sesión no válida' }) }
  }

  if (!Array.isArray(reminders) || reminders.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ sent: 0, message: 'Sin recordatorios pendientes.' }) }
  }

  const items = reminders
    .map((r) => {
      const label = r.feeType === 'annual' ? 'comisión anual' : 'comisión mensual'
      const when = r.dueInDays === 0 ? 'es HOY' : `es en ${r.dueInDays} día(s)`
      return `<li><strong>${escapeHtml(r.account)}</strong>: ${label} de <strong>${money(r.amount)}</strong> programada para el <strong>${escapeHtml(r.due)}</strong> (${when}).</li>`
    })
    .join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:16px">
      <h2 style="color:#0f172a;margin:0 0 8px">⏰ Recordatorio de comisiones de tarjeta</h2>
      <p style="color:#475569;margin:0 0 16px">Hola ${escapeHtml(user.email.split('@')[0] || '')}, tienes ${reminders.length} comisión(es) próximas:</p>
      <ul style="color:#0f172a;line-height:1.8">${items}</ul>
      <p style="color:#94a3b8;font-size:12px;margin-top:20px">Aviso generado por Control Financiero Personal.</p>
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'onboarding@resend.dev',
      to: user.email,
      subject: `Recordatorio: ${reminders.length} comisión(es) de tarjeta próximas`,
      html
    })
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { statusCode: 502, body: JSON.stringify({ message: `Resend: ${data.message || `HTTP ${res.status}`}` }) }
  }

  return { statusCode: 200, body: JSON.stringify({ sent: reminders.length, id: data.id }) }
}