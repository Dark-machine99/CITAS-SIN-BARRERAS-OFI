import { CalendarDays, CircleHelp, HeartPulse, LayoutDashboard, LogOut, Menu, Settings2, Stethoscope, UserRound, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useBooking } from '../../app/providers/BookingProvider'
import { useDemoSession } from '../../app/providers/DemoSessionProvider'
import { useAuth } from '../../app/providers/AuthProvider'
import { Brand } from '../ui/Brand'
import { Button } from '../ui/Button'
import { PatientSessionTimeoutModal } from '../../features/auth/PatientSessionTimeoutModal'
import { endPatientSession, type PatientSessionEndReason } from '../../features/auth/patientSessionTimeout'
import { PatientTutorialProvider, usePatientTutorial } from '../../features/tutorial/PatientTutorialProvider'
import { PatientTutorialOverlay } from '../../features/tutorial/PatientTutorialOverlay'

const links = [
  ['inicio', '/paciente', 'Inicio', LayoutDashboard], ['reservar', '/paciente/reservar', 'Reservar', CalendarDays], ['citas', '/paciente/citas', 'Mis citas', HeartPulse],
  ['medicos', '/paciente/medicos', 'Médicos', Stethoscope], ['especialidades', '/paciente/especialidades', 'Especialidades', HeartPulse], ['accesibilidad', '/paciente/accesibilidad', 'Accesibilidad', Settings2], ['perfil', '/paciente/perfil', 'Mi perfil', UserRound],
] as const

export function PatientLayout() {
  const { session } = useAuth()
  return <PatientTutorialProvider userId={session?.user.id ?? null}><PatientLayoutContent /></PatientTutorialProvider>
}

function PatientLayoutContent() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate(); const { leaveDemo } = useDemoSession(); const { status, session, profile, signOut } = useAuth(); const { resetSensitive } = useBooking()
  const tutorial = usePatientTutorial()
  const sessionEndInFlight = useRef(false)
  const name = profile?.first_name ?? 'Paciente'; const initials = `${profile?.first_name?.[0] ?? 'P'}${profile?.last_name?.[0] ?? ''}`.toUpperCase()
  const endSession = useCallback(async (reason: PatientSessionEndReason) => {
    if (sessionEndInFlight.current) return
    sessionEndInFlight.current = true
    await endPatientSession({
      reason,
      resetSensitive,
      leaveDemo,
      signOut,
      navigateToLogin: (sessionEnded) => navigate('/login', { replace: true, state: { sessionEnded } }),
    })
  }, [leaveDemo, navigate, resetSensitive, signOut])
  return <div className="patient-shell">
    <a href="#contenido" className="skip-link">Saltar al contenido principal</a>
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label="Navegación del paciente" data-tour-id="patient-navigation-desktop">
      <div className="sidebar__top"><Brand /><Button variant="ghost" className="icon-button sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></Button></div>
      <div className="demo-chip">Cuenta Paciente</div>
      <nav>{links.map(([id, to, label, Icon]) => <NavLink key={to} to={to} data-tour-id={`patient-nav-${id}-desktop`} onClick={() => setMenuOpen(false)} end={to === '/paciente'} className={({ isActive }) => isActive ? 'active' : ''}><Icon aria-hidden="true" />{label}</NavLink>)}</nav>
      <Button variant="ghost" onClick={() => void endSession('manual')}><LogOut aria-hidden="true" />Cerrar sesión</Button>
    </aside>
    <div className="patient-main">
      <header className="patient-topbar" data-tour-id="patient-header"><Button variant="ghost" className="icon-button menu-button" data-tour-id="patient-menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu /></Button><div><span className="eyebrow">Espacio personal</span><strong>Hola, {name}</strong></div><div className="patient-topbar__actions"><Button variant="ghost" className="patient-tutorial-help" data-tour-id="patient-tutorial-help" onClick={(event) => tutorial.repeat(event.currentTarget)}><CircleHelp aria-hidden="true" /><span>Ayuda y tutorial</span></Button><span className="avatar" aria-hidden="true">{initials}</span></div></header>
      <main id="contenido" tabIndex={-1} className="patient-content" data-tour-id="patient-content"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Navegación móvil" data-tour-id="patient-navigation-mobile">{links.slice(0, 4).map(([id, to, label, Icon]) => <NavLink key={to} to={to} data-tour-id={`patient-nav-${id}-mobile`} end={to === '/paciente'}><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
    </div>
    <PatientSessionTimeoutModal
      enabled={status === 'authenticated' && profile?.role === 'patient'}
      sessionKey={session?.user.id ?? null}
      onSessionEnd={endSession}
    />
    <PatientTutorialOverlay />
  </div>
}
