import { ArrowLeft, LockKeyhole, MapPinned } from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
export function ForbiddenPage() { return <StatePage icon={<LockKeyhole />} title="Acceso no disponible" text="Esta vista no forma parte del espacio de paciente de la demostración." /> }
export function NotFoundPage() { return <StatePage icon={<MapPinned />} title="No encontramos esa página" text="Revisa la dirección o vuelve al inicio del prototipo." /> }
function StatePage({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <section className="state-page section-pad"><div className="state-illustration">{icon}</div><h1>{title}</h1><p>{text}</p><ButtonLink to="/"><ArrowLeft />Volver al inicio</ButtonLink></section> }
