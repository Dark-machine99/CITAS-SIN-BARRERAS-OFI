import { Accessibility, ArrowRight } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { Brand } from '../ui/Brand'
import { ButtonLink } from '../ui/Button'

export function PublicLayout() {
  return <div className="site-shell">
    <a href="#contenido" className="skip-link">Saltar al contenido principal</a>
    <header className="public-header">
      <Brand />
      <nav aria-label="Navegación principal">
        <Link to="/accesibilidad"><Accessibility aria-hidden="true" />Accesibilidad</Link>
        <Link to="/login">Ingresar</Link>
        <ButtonLink to="/registro">Crear cuenta <ArrowRight aria-hidden="true" /></ButtonLink>
      </nav>
    </header>
    <main id="contenido" tabIndex={-1}><Outlet /></main>
    <footer className="public-footer"><Brand /><p>Proyecto académico conectado a un entorno Supabase cloud de pruebas. Utiliza únicamente datos ficticios.</p><nav aria-label="Enlaces de pie"><Link to="/privacidad">Aviso de privacidad</Link><Link to="/accesibilidad">Accesibilidad</Link></nav></footer>
  </div>
}
