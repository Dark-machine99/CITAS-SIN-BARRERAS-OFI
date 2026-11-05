import { Activity, CalendarDays, ClipboardList, Clock3, Gauge, LogOut, Menu, Settings2, Stethoscope, Tags, UserRoundCog, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
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
  const session = useDemoSession()
  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [location.pathname])
  if (!session.active || session.role !== role) return <Navigate to="/acceso-denegado" replace />
  if (role === 'doctor' && session.mustChangeDoctorPassword && location.pathname !== '/medico/cambiar-contrasena') return <Navigate to="/medico/cambiar-contrasena" replace />
  if (role === 'doctor' && !session.mustChangeDoctorPassword && location.pathname === '/medico/cambiar-contrasena') return <Navigate to="/medico" replace />
  const links = role === 'doctor' ? doctorLinks : adminLinks
  const roleName = role === 'doctor' ? 'Médico' : 'Administración'
  const exit = () => { session.leaveDemo(); navigate('/acceso-demo') }
  return <div className={`patient-shell role-shell role-shell--${role}`}>
    <a href="#contenido" className="skip-link">Saltar al contenido principal</a>
    <aside className={`sidebar role-sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label={`Navegación de ${roleName}`}>
      <div className="sidebar__top"><Brand /><Button variant="ghost" className="icon-button sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></Button></div>
      <div className="role-emblem" aria-hidden="true"><span>{role === 'doctor' ? <Activity /> : <UserRoundCog />}</span><i /><i /></div>
      <div className="demo-chip">Modo {roleName} · DEMO</div>
      <nav>{links.map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} end={to === `/${role === 'doctor' ? 'medico' : 'administracion'}`} className={({ isActive }) => isActive ? 'active' : ''}><Icon aria-hidden="true" />{label}</NavLink>)}</nav>
      <NavLink className="sidebar-access-link" to="/accesibilidad"><Settings2 aria-hidden="true" /> Accesibilidad</NavLink>
      <Button variant="ghost" onClick={exit}><LogOut aria-hidden="true" />Salir de la demo</Button>
    </aside>
    <div className="patient-main">
      <header className="patient-topbar role-topbar"><Button variant="ghost" className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu /></Button><div><span className="eyebrow">{roleName} · entorno de demostración</span><strong>{role === 'doctor' ? 'Dra. Lucía Rivera Demo' : 'Panel de coordinación'}</strong></div><span className="avatar" aria-hidden="true">{role === 'doctor' ? 'LR' : 'AD'}</span></header>
      <main id="contenido" tabIndex={-1} className="patient-content role-content"><Outlet /></main>
      <nav className="bottom-nav role-bottom-nav" aria-label={`Navegación móvil de ${roleName}`}>{links.slice(0, 4).map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === `/${role === 'doctor' ? 'medico' : 'administracion'}`}><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
    </div>
  </div>
}
