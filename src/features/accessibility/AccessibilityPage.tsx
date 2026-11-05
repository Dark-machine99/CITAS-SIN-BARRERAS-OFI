import { Accessibility, Check, Contrast, Eye, Focus, MousePointer2, PersonStanding, ScanEye, Sparkles, Type, ZoomIn } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAccessibility, type AccessibilityPreset, type TextScale } from '../../app/providers/AccessibilityProvider'
import { Button } from '../../components/ui/Button'

const presetOptions: { id: AccessibilityPreset; title: string; description: string; icon: typeof Eye }[] = [
  { id: 'standard', title: 'Estándar', description: 'Base accesible sin ajustes extra.', icon: Sparkles },
  { id: 'low-vision', title: 'Baja visión', description: 'Texto grande, contraste alto, cursor amplio y lupa.', icon: Eye },
  { id: 'reduced-mobility', title: 'Movilidad reducida', description: 'Modo simple, cursor amplio y menos movimiento.', icon: PersonStanding },
  { id: 'colorblind', title: 'Daltonismo', description: 'Refuerza patrones, texto e iconos de estado.', icon: ScanEye },
  { id: 'focus', title: 'Concentración', description: 'Reduce movimiento y simplifica el flujo.', icon: Focus },
  { id: 'older-adult', title: 'Adulto mayor', description: 'Texto grande, controles amplios y modo simple.', icon: Accessibility },
  { id: 'custom', title: 'Personalizado', description: 'Combina libremente los controles siguientes.', icon: Type },
]

export function AccessibilityPage({ onboarding = false, authenticated = false }: { onboarding?: boolean; authenticated?: boolean }) {
  const { preferences, update, applyPreset, systemReducedMotion, persistence, persistenceError, save } = useAccessibility(); const navigate = useNavigate()
  const finish = async () => { try { await save(); if (onboarding) void navigate('/paciente'); else void navigate(-1) } catch { /* El contexto muestra el error sin abandonar los ajustes. */ } }
  return <section className={`access-page ${authenticated ? 'access-page--patient' : 'section-pad'}`}><div className="page-heading"><div><span className="eyebrow"><Accessibility /> Preferencias inclusivas</span><h1>{onboarding ? 'Configura la experiencia a tu manera' : 'Accesibilidad'}</h1><p>Los ajustes se aplican al instante y, al guardar con una cuenta Paciente, quedan disponibles en tu próxima sesión. No describen ni diagnostican una condición.</p></div></div>
    <div className="preset-grid" role="radiogroup" aria-label="Perfil de accesibilidad">{presetOptions.map(({ id, title, description, icon: Icon }) => <button key={id} type="button" role="radio" aria-checked={preferences.preset === id} className={`preset-card ${preferences.preset === id ? 'selected' : ''}`} onClick={() => applyPreset(id)}><span className="preset-icon"><Icon /></span><span><strong>{title}</strong><small>{description}</small></span>{preferences.preset === id ? <Check className="preset-check" /> : null}</button>)}</div>
    <div className="settings-panel"><div className="setting-row"><div><span className="setting-icon"><Type /></span><span><strong>Tamaño del texto</strong><small>Ajusta la escala sin impedir el zoom del navegador.</small></span></div><div className="segmented" aria-label="Tamaño del texto">{(['small', 'normal', 'large'] as TextScale[]).map((scale, index) => <button key={scale} className={preferences.textScale === scale ? 'active' : ''} aria-pressed={preferences.textScale === scale} onClick={() => update({ textScale: scale })}>{['A−', 'A', 'A+'][index]}</button>)}</div></div>
      <Toggle icon={<Contrast />} label="Alto contraste" description="Fondo negro, texto blanco y acciones amarillas." checked={preferences.highContrast} onChange={(checked) => update({ highContrast: checked })} />
      <Toggle icon={<MousePointer2 />} label="Cursor grande" description="Disponible en equipos con puntero." checked={preferences.largeCursor} onChange={(checked) => update({ largeCursor: checked })} />
      <Toggle icon={<Sparkles />} label="Reducir movimiento" description={systemReducedMotion ? 'Tu sistema ya solicita movimiento reducido.' : 'Desactiva transiciones, tilt y movimiento decorativo.'} checked={preferences.reducedMotion} onChange={(checked) => update({ reducedMotion: checked })} />
      <Toggle icon={<Focus />} label="Modo simple" description="Agrupa la reserva en 3 pasos manteniendo la misma información." checked={preferences.simpleMode} onChange={(checked) => update({ simpleMode: checked })} />
      <Toggle icon={<ScanEye />} label="Guía de lectura" description="Añade una franja suave que acompaña el puntero en escritorio." checked={preferences.readingGuide} onChange={(checked) => update({ readingGuide: checked })} />
      <Toggle icon={<ZoomIn />} label="Lupa de texto" description="Amplía el texto bajo el puntero o el foco sin necesidad de hacer clic." checked={preferences.magnifier} onChange={(checked) => update({ magnifier: checked })} />
      <Toggle icon={<Eye />} label="Refuerzo de estados" description="Añade patrones y etiquetas visibles, además del color." checked={preferences.colorReinforcement} onChange={(checked) => update({ colorReinforcement: checked })} />
    </div>{persistenceError ? <div className="notice notice--error" role="alert">{persistenceError}</div> : null}<div className="access-actions">{onboarding ? <Button variant="ghost" onClick={() => { applyPreset('standard'); navigate('/paciente') }}>Omitir por ahora</Button> : null}<Button loading={persistence === 'saving'} onClick={() => void finish()}>{onboarding ? 'Usar estas preferencias' : 'Guardar y volver'}</Button></div>
  </section>
}

function Toggle({ icon, label, description, checked, onChange }: { icon: React.ReactNode; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = `setting-${label.toLowerCase().replaceAll(' ', '-')}`
  return <div className="setting-row toggle-row"><label htmlFor={id}><span className="setting-icon">{icon}</span><span><strong>{label}</strong><small>{description}</small></span></label><span className="toggle"><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></span></div>
}
