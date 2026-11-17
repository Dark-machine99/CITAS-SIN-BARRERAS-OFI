import { Activity, CalendarDays, ClipboardList, Clock3, Gauge, LogOut, Menu, Settings2, Stethoscope, Tags, UserRoundCog, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../app/providers/AuthProvider'
import { useDemoSession } from '../../app/providers/DemoSessionProvider'
import type { DemoRole } from '../../types/medicalAdmin'
import { Brand } from '../ui/Brand'
import { Button } from '../ui/Button'

const doctorLinks = [
  ['/medico', 'Mi agenda', CalendarDays],
] as const
const adminLinks = [
  ['/administracion', 'Resumen', Gauge],
  ['/administracion/medicos', 'Profesionales', Stethoscope],
  ['/administracion/especialidades', 'Especialidades', Tags],
  ['/administracion/horarios', 'Horarios', Clock3],
  ['/administracion/citas', 'Citas', ClipboardList],
  ['/administracion/usuarios', 'Usuarios', UsersRound],
] as const

export function RoleLayout({ appRole: role }: { appRole: Extract<DemoRole, 'doctor' | 'admin'> }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const demoSession = useDemoSession()
  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [location.pathname])
  const doctorAuthorized = auth.status === 'authenticated' && auth.profile?.role === 'doctor'
  const adminAuthorized = demoSession.active && demoSession.role === 'admin'
  if (role === 'doctor' ? !doctorAuthorized : !adminAuthorized) return <Navigate to="/acceso-denegado" replace />
  const links = role === 'doctor' ? doctorLinks : adminLinks
  const roleName = role === 'doctor' ? 'Médico' : 'Administración'
  const profileName = role === 'doctor' ? `${auth.profile?.first_name ?? ''} ${auth.profile?.last_name ?? ''}`.trim() : 'Panel de coordinación'
  const initials = role === 'doctor' ? `${auth.profile?.first_name?.[0] ?? ''}${auth.profile?.last_name?.[0] ?? ''}`.toUpperCase() : 'AD'
  const exit = () => {
    if (role === 'doctor') void auth.signOut().finally(() => navigate('/login', { replace: true, state: { sessionEnded: 'manual' } }))
    else { demoSession.leaveDemo(); navigate('/acceso-demo') }
  }
  return <div className={`patient-shell role-shell role-shell--${role}`}>
    <a href="#contenido" className="skip-link">Saltar al contenido principal</a>
    <aside className={`sidebar role-sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label={`Navegación de ${roleName}`}>
      <div className="sidebar__top"><Brand /><Button variant="ghost" className="icon-button sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></Button></div>
      <div className="role-emblem" aria-hidden="true"><span>{role === 'doctor' ? <Activity /> : <UserRoundCog />}</span><i /><i /></div>
      <div className="demo-chip">{role === 'doctor' ? 'Sesión médica verificada' : `Modo ${roleName} · DEMO`}</div>
      <nav>{links.map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} end={to === `/${role === 'doctor' ? 'medico' : 'administracion'}`} className={({ isActive }) => isActive ? 'active' : ''}><Icon aria-hidden="true" />{label}</NavLink>)}</nav>
      <NavLink className="sidebar-access-link" to={role === 'doctor' ? '/medico/accesibilidad' : '/accesibilidad'}><Settings2 aria-hidden="true" /> Accesibilidad</NavLink>
      <Button variant="ghost" onClick={exit}><LogOut aria-hidden="true" />{role === 'doctor' ? 'Cerrar sesión' : 'Salir de la demo'}</Button>
    </aside>
    <div className="patient-main">
      <header className="patient-topbar role-topbar"><Button variant="ghost" className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu /></Button><div><span className="eyebrow">{role === 'doctor' ? 'Médico · cuenta autenticada' : 'Administración · entorno de demostración'}</span><strong>{profileName}</strong></div><span className="avatar" aria-hidden="true">{initials}</span></header>
      <main id="contenido" tabIndex={-1} className="patient-content role-content"><Outlet /></main>
      <nav className="bottom-nav role-bottom-nav" aria-label={`Navegación móvil de ${roleName}`}>{links.slice(0, 4).map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === `/${role === 'doctor' ? 'medico' : 'administracion'}`}><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
    </div>
  </div>
}
