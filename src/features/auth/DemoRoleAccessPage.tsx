import { ArrowRight, ShieldCheck, Stethoscope, UserRound, UserRoundCog } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useDemoSession } from '../../app/providers/DemoSessionProvider'
import { Button } from '../../components/ui/Button'
import type { DemoRole } from '../../types/medicalAdmin'

const roles = [
  { role: 'patient', title: 'Paciente', description: 'Reserva y gestiona citas en el recorrido accesible.', icon: UserRound, to: '/paciente', demo: true },
  { role: 'doctor', title: 'Médico', description: 'Ingresa con la cuenta médica que recibiste por invitación.', icon: Stethoscope, to: '/login', demo: false },
  { role: 'admin', title: 'Administración', description: 'Coordina el catálogo y revisa datos operativos mínimos.', icon: UserRoundCog, to: '/administracion', demo: true },
] satisfies { role: DemoRole; title: string; description: string; icon: typeof UserRound; to: string; demo: boolean }[]

export function DemoRoleAccessPage() {
  const navigate = useNavigate()
  const { enterDemo } = useDemoSession()
  const choose = (role: DemoRole, to: string, demo: boolean) => { if (demo) enterDemo(role); navigate(to) }
  return <section className="role-access section-pad">
    <div className="role-access__hero"><span className="eyebrow"><ShieldCheck /> Acceso local controlado</span><h1>Elige un espacio de demostración</h1><p>Cada rol muestra solo la información prevista para su trabajo. No se crean cuentas ni se envían datos.</p></div>
    <div className="role-access__grid">{roles.map(({ role, title, description, icon: Icon, to, demo }) => <article className={`role-card role-card--${role}`} key={role}><div className="role-card__scene"><span><Icon /></span><i /><i /></div><div><span className="demo-label">{demo ? 'Rol de demostración' : 'Cuenta autenticada'}</span><h2>{title}</h2><p>{description}</p><Button onClick={() => choose(role, to, demo)}>{demo ? 'Entrar como' : 'Ir al ingreso de'} {title}<ArrowRight /></Button></div></article>)}</div>
  </section>
}
