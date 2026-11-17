import { ShieldAlert, Stethoscope } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../app/providers/AuthProvider'
import { Button } from '../../components/ui/Button'

export const doctorFirstAccessPath = '/medico/cambiar-contrasena'

function AccountSessionLoading({ doctor = false }: { doctor?: boolean }) {
  return <main className="session-state" aria-busy="true" aria-live="polite"><Stethoscope aria-hidden="true" /><span className="eyebrow">{doctor ? 'Acceso médico seguro' : 'Cuenta segura'}</span><h1>Verificando tu cuenta…</h1><p>{doctor ? 'Estamos comprobando tu sesión y el estado de primer acceso.' : 'Estamos comprobando tu sesión antes de mostrar tus preferencias.'}</p></main>
}

function AccountVerificationError({ doctor = false }: { doctor?: boolean }) {
  const auth = useAuth()
  const navigate = useNavigate()
  return <main className="session-state" role="alert"><ShieldAlert aria-hidden="true" /><h1>No pudimos verificar tu {doctor ? 'acceso médico' : 'cuenta'}</h1><p>{doctor ? 'Tu agenda permanece bloqueada.' : 'Tus preferencias permanecen bloqueadas.'} Reintenta la verificación o vuelve a iniciar sesión.</p><div className="button-row"><Button onClick={() => void auth.reloadAccount().catch(() => undefined)}>Reintentar</Button><Button variant="secondary" onClick={() => void auth.signOut().finally(() => navigate('/login', { replace: true }))}>Volver al ingreso</Button></div></main>
}

export function DoctorFirstAccessBoundary({ children }: PropsWithChildren) {
  const auth = useAuth()
  const location = useLocation()
  const isDoctorRoute = location.pathname === '/medico' || location.pathname.startsWith('/medico/')
  const isPreferencesRoute = location.pathname === '/accesibilidad' || location.pathname === '/onboarding/accesibilidad'

  if (isDoctorRoute && auth.status === 'loading') return <AccountSessionLoading doctor />
  if (isPreferencesRoute && auth.status === 'loading') return <AccountSessionLoading />
  if (isPreferencesRoute && auth.status === 'error' && auth.session) return <AccountVerificationError />
  if (auth.status === 'authenticated' && auth.profile?.role === 'doctor') {
    if (auth.profile.must_change_password && location.pathname !== doctorFirstAccessPath) return <Navigate to={doctorFirstAccessPath} replace />
    if (!auth.profile.must_change_password && location.pathname === doctorFirstAccessPath) return <Navigate to="/medico" replace />
  }
  return children
}

export function RequireDoctor() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <AccountSessionLoading doctor />
  if (auth.status === 'signed-out') return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (auth.status === 'error') return <AccountVerificationError doctor />
  if (auth.profile?.role !== 'doctor') return <Navigate to="/acceso-denegado" replace />
  return <Outlet />
}
