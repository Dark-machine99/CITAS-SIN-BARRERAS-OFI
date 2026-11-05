import { Accessibility, ArrowRight, CalendarCheck2, Check, Clock3, HeartPulse, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react'
import { motion } from 'motion/react'
import { useAccessibility } from '../../app/providers/AccessibilityProvider'
import { ButtonLink } from '../../components/ui/Button'

export function LandingPage() {
  const { effectiveReducedMotion } = useAccessibility()
  return <>
    <section className="hero section-pad">
      <div className="hero__copy">
        <span className="eyebrow"><Sparkles aria-hidden="true" /> Atención clara, a tu ritmo</span>
        <h1>Tu salud merece un camino <em>sin barreras.</em></h1>
        <p className="hero__lead">Explora una forma accesible, tranquila y visual de organizar tus citas médicas. Tu cuenta, perfil y preferencias se protegen en un entorno cloud de pruebas.</p>
        <div className="button-row"><ButtonLink to="/paciente" className="button--large">Probar como paciente <ArrowRight aria-hidden="true" /></ButtonLink><ButtonLink to="/accesibilidad" variant="secondary" className="button--large"><Accessibility aria-hidden="true" />Personalizar acceso</ButtonLink></div>
        <ul className="trust-list" aria-label="Características"><li><Check />Cloud de pruebas</li><li><Check />Compatible con teclado</li><li><Check />Preferencias guardadas</li></ul>
      </div>
      <motion.div className="hero-scene" initial={effectiveReducedMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: effectiveReducedMotion ? 0 : .6 }} aria-label="Ilustración tridimensional de atención médica accesible">
        <div className="scene-glow" /><div className="scene-platform"><div className="scene-ring" /><div className="medical-tower"><span className="cross-shape" /><div className="tower-window" /><div className="tower-window tower-window--two" /></div><div className="care-orb"><HeartPulse /></div></div>
        <div className="float-card float-card--top"><span className="float-icon"><CalendarCheck2 /></span><span><strong>Reserva guiada</strong><small>7 pasos o modo simple</small></span></div>
        <div className="float-card float-card--bottom"><span className="float-icon mint"><ShieldCheck /></span><span><strong>Privacidad clara</strong><small>Entorno cloud de pruebas</small></span></div>
      </motion.div>
    </section>
    <section className="proof-strip" aria-label="Principios de la experiencia"><div><Accessibility /><strong>Accesible por diseño</strong><span>WCAG 2.2 AA como objetivo</span></div><div><Clock3 /><strong>A tu propio ritmo</strong><span>Movimiento y modo simple configurables</span></div><div><ShieldCheck /><strong>Pruebas responsables</strong><span>Cuenta cloud con datos ficticios</span></div></section>
    <section className="section-pad experience-section">
      <div className="section-heading"><span className="eyebrow">Una experiencia que se adapta</span><h2>Menos fricción. Más claridad.</h2><p>La misma reserva, presentada de la manera que te resulte más cómoda.</p></div>
      <div className="feature-grid">
        <article className="feature-card feature-card--blue"><div className="feature-visual orbit-visual"><span /><span /><Stethoscope /></div><span className="step-number">01</span><h3>Encuentra la atención adecuada</h3><p>Explora especialidades y profesionales con información clara para elegir con tranquilidad.</p></article>
        <article className="feature-card feature-card--mint"><div className="feature-visual calendar-visual"><CalendarCheck2 /></div><span className="step-number">02</span><h3>Reserva sin perderte</h3><p>Elige entre siete pasos detallados o tres agrupaciones simples, sin perder tu selección.</p></article>
        <article className="feature-card feature-card--violet"><div className="feature-visual access-visual"><Accessibility /></div><span className="step-number">03</span><h3>Hazlo verdaderamente tuyo</h3><p>Ajusta tamaño de texto, contraste, movimiento y apoyos de lectura en cualquier momento.</p></article>
      </div>
    </section>
    <section className="section-pad cta-panel"><div><span className="eyebrow eyebrow--light">Recorrido completo</span><h2>Organiza una cita con una experiencia clara, guiada y adaptable.</h2></div><ButtonLink to="/paciente" variant="secondary" className="button--large">Ir a mi espacio <ArrowRight /></ButtonLink></section>
  </>
}
