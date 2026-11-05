import { ArrowRight, ShieldCheck, Stethoscope, UserRound, UserRoundCog } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useDemoSession } from '../../app/providers/DemoSessionProvider'
import { Button } from '../../components/ui/Button'
import type { DemoRole } from '../../types/medicalAdmin'

const roles = [
  { role: 'patient', title: 'Paciente', description: 'Reserva y gestiona citas en el recorrido accesible.', icon: UserRound, to: '/paciente' },
  { role: 'doctor', title: 'Médico', description: 'Consulta únicamente tu agenda y registra asistencia.', icon: Stethoscope, to: '/medico' },
  { role: 'admin', title: 'Administración', description: 'Coordina el catálogo y revisa datos operativos mínimos.', icon: UserRoundCog, to: '/administracion' },
] satisfies { role: DemoRole; title: string; description: string; icon: typeof UserRound; to: string }[]

export function DemoRoleAccessPage() {
  const navigate = useNavigate()
  const { enterDemo } = useDemoSession()
  const choose = (role: DemoRole, to: string) => { enterDemo(role); navigate(to) }
  return <section className="role-access section-pad">
    <div className="role-access__hero"><span className="eyebrow"><ShieldCheck /> Acceso local controlado</span><h1>Elige un espacio de demostración</h1><p>Cada rol muestra solo la información prevista para su trabajo. No se crean cuentas ni se envían datos.</p></div>
    <div className="role-access__grid">{roles.map(({ role, title, description, icon: Icon, to }) => <article className={`role-card role-card--${role}`} key={role}><div className="role-card__scene"><span><Icon /></span><i /><i /></div><div><span className="demo-label">Rol de demostración</span><h2>{title}</h2><p>{description}</p><Button onClick={() => choose(role, to)}>Entrar como {title}<ArrowRight /></Button></div></article>)}</div>
  </section>
}
