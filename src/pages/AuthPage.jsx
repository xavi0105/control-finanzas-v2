import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Wallet } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/')
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw new Error(signUpError.message)
        setInfo('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-logo large"><Wallet size={26} /></span>
          <h1>Control de Finanzas</h1>
          <p>Administra tus cuentas, gastos, ingresos y metas de ahorro en un solo lugar.</p>
        </div>

        <div className="auth-tabs">
          <button className={`tab-auth${mode === 'login' ? ' active' : ''}`} onClick={() => { setMode('login'); setError(''); setInfo('') }}>
            Iniciar sesión
          </button>
          <button className={`tab-auth${mode === 'signup' ? ' active' : ''}`} onClick={() => { setMode('signup'); setError(''); setInfo('') }}>
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <div className="input-wrap">
              <Mail size={16} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <div className="input-wrap">
              <Lock size={16} />
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button type="button" className="icon-btn" onClick={() => setShowPass((v) => !v)} aria-label="Mostrar contraseña">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {info && <div className="alert alert-info">{info}</div>}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>
      </div>
    </div>
  )
}