import { FlaskConical } from 'lucide-react'
export function DemoBanner({ compact = false }: { compact?: boolean }) {
  return <div className={`demo-banner ${compact ? 'demo-banner--compact' : ''}`} role="note">
    <FlaskConical aria-hidden="true" /><span><strong>Piloto en construcción.</strong> Cuenta, perfil, preferencias y confirmación de reserva Paciente usan Supabase; Mis citas y los paneles clínicos siguen simulados.</span>
  </div>
}
