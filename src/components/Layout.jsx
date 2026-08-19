import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Wallet, PiggyBank, BarChart3, Settings as SettingsIcon, Sparkles, LogOut, Sun, Moon, CalendarClock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'

const navItems = [
  { to: '/', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/recomendador', label: 'Recomendador', icon: Sparkles },
  { to: '/transacciones', label: 'Transacciones', icon: ArrowLeftRight },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet },
  { to: '/gastos', label: 'Gastos fijos', icon: CalendarClock },
  { to: '/metas', label: 'Metas', icon: PiggyBank },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/ajustes', label: 'Ajustes', icon: SettingsIcon }
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('online', () => setOnline(true))
      window.removeEventListener('offline', () => setOnline(false))
    }
  }, [])

  const installPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setDeferredPrompt(null)
    } else {
      showToast('Puedes instalar la app desde el menú de tu navegador.', '📱')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const today = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-logo">📊</div>
            <div>
              <h1 className="brand-title">
                Control Financiero Personal
              </h1>
              <p className="brand-sub">Cuentas, gastos, metas y alertas inteligentes</p>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="chip chip-slate" onClick={toggleTheme} title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Claro' : 'Oscuro'}
            </button>
            {deferredPrompt && (
              <button className="chip chip-purple" onClick={installPwa} title="Instalar app en tu dispositivo">
                📱 Instalar App
              </button>
            )}
            <span className={`chip ${online ? 'chip-green' : 'chip-red'}`}>
              <span className="dot" /> {online ? 'En línea' : 'Sin conexión'}
            </span>
            <span className="chip chip-slate hidden-sm">{today}</span>
            <button className="chip chip-indigo" onClick={handleSignOut} title="Cerrar sesión">
              <LogOut size={14} /> {user?.email?.split('@')[0] || 'Salir'}
            </button>
          </div>
        </div>

        <nav className="tabbar">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
              <span className="tab-icon"><Icon size={16} /></span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="page-main">
        <Outlet />
      </main>
    </div>
  )
}