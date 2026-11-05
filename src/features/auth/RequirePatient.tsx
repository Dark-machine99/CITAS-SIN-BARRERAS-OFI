import { ShieldAlert } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../app/providers/AuthProvider'
import { Button } from '../../components/ui/Button'

export function RequirePatient() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <main className="session-state" aria-busy="true"><span className="eyebrow">Cuenta segura</span><h1>Cargando tu espacio…</h1><p>Estamos verificando tu sesión y tus preferencias.</p></main>
  if (auth.status === 'signed-out') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (auth.status === 'error') return <main className="session-state"><ShieldAlert aria-hidden="true" /><h1>No pudimos abrir tu cuenta</h1><p>{auth.error ?? 'Falta el perfil asociado a esta sesión.'}</p><Button onClick={() => void auth.signOut()}>Cerrar sesión y volver</Button></main>
  if (auth.profile?.role !== 'patient') return <Navigate to="/acceso-denegado" replace />
  return <Outlet />
}
