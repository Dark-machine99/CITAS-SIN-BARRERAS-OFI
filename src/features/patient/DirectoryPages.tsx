import { ArrowRight, Bone, Brain, Eye, HeartPulse, Search, Sparkles, Stethoscope } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useBooking } from '../../app/providers/BookingProvider'
import { DictationButton } from '../../components/assistive/DictationButton'
import { Button } from '../../components/ui/Button'
import { patientDirectoryAdapter, type PatientDirectoryAdapter, type PatientDirectoryData } from '../../services/supabase/patientDirectoryAdapter'

const specialtyIcons = [HeartPulse, Brain, Bone, Sparkles, Stethoscope, Eye] as const
const emptyDirectoryData: PatientDirectoryData = { specialties: [], doctors: [] }

type DirectoryLoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: PatientDirectoryData }

interface DirectoryPageProps {
  directoryAdapter?: PatientDirectoryAdapter
}

function usePatientDirectory(directoryAdapter: PatientDirectoryAdapter) {
  const [state, setState] = useState<DirectoryLoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    void directoryAdapter.load().then(
      (data) => { if (current) setState({ status: 'ready', data }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [attempt, directoryAdapter])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((current) => current + 1)
  }, [])

  return { state, retry }
}

export function SpecialtiesPage({ directoryAdapter = patientDirectoryAdapter }: DirectoryPageProps = {}) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { updateDraft } = useBooking()
  const { state, retry } = usePatientDirectory(directoryAdapter)
  const specialties = state.status === 'ready' ? state.data.specialties : emptyDirectoryData.specialties
  const normalizedQuery = query.trim().toLocaleLowerCase('es-PE')
  const filtered = useMemo(() => specialties.filter((item) => `${item.name} ${item.description}`.toLocaleLowerCase('es-PE').includes(normalizedQuery)), [normalizedQuery, specialties])
  const select = (id: string) => { updateDraft({ specialtyId: id, doctorId: null, date: null, time: null }); navigate('/paciente/reservar?from=specialty') }

  return <div aria-busy={state.status === 'loading'}>
    <PageTitle eyebrow="Directorio médico" title="Especialidades" text="Consulta las especialidades activas disponibles para iniciar tu reserva." />
    {state.status === 'ready' && specialties.length ? <SearchBox value={query} onChange={setQuery} label="Buscar especialidad" /> : null}
    {state.status === 'loading' ? <DirectoryLoading label="Cargando especialidades" /> : null}
    {state.status === 'error' ? <DirectoryError onRetry={retry} /> : null}
    {state.status === 'ready' && !specialties.length ? <EmptyDirectory kind="specialties" /> : null}
    {state.status === 'ready' && specialties.length && filtered.length ? <div className="specialty-grid">{filtered.map((item, index) => { const Icon = specialtyIcons[index % specialtyIcons.length]!; return <article className={`specialty-card specialty-card--${index % 4}`} key={item.id}><div className="specialty-art"><Icon aria-hidden="true" /></div><span className="demo-label">Especialidad activa</span><h2>{item.name}</h2><p>{item.description}</p><Button variant="secondary" onClick={() => select(item.id)}>Elegir especialidad <ArrowRight aria-hidden="true" /></Button></article> })}</div> : null}
    {state.status === 'ready' && specialties.length && !filtered.length ? <EmptySearch /> : null}
  </div>
}

export function DoctorsPage({ directoryAdapter = patientDirectoryAdapter }: DirectoryPageProps = {}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()
  const { draft, updateDraft } = useBooking()
  const { state, retry } = usePatientDirectory(directoryAdapter)
  const data = state.status === 'ready' ? state.data : emptyDirectoryData
  const specialtyNames = useMemo(() => new Map(data.specialties.map((item) => [item.id, item.name])), [data.specialties])
  const effectiveFilter = filter === 'all' || specialtyNames.has(filter) ? filter : 'all'
  const normalizedQuery = query.trim().toLocaleLowerCase('es-PE')
  const filtered = useMemo(() => data.doctors.filter((doctor) => {
    const matchesFilter = effectiveFilter === 'all' || doctor.specialtyIds.includes(effectiveFilter)
    const searchable = `${doctor.name} ${doctor.specialtyIds.map((id) => specialtyNames.get(id) ?? '').join(' ')}`.toLocaleLowerCase('es-PE')
    return matchesFilter && searchable.includes(normalizedQuery)
  }), [data.doctors, effectiveFilter, normalizedQuery, specialtyNames])
  const select = (doctorId: string, specialtyIds: string[]) => {
    const specialtyId = effectiveFilter !== 'all' && specialtyIds.includes(effectiveFilter)
      ? effectiveFilter
      : draft.specialtyId && specialtyIds.includes(draft.specialtyId)
        ? draft.specialtyId
        : specialtyIds[0]
    if (!specialtyId) return
    updateDraft({ doctorId, specialtyId, date: null, time: null })
    navigate('/paciente/reservar?from=doctor')
  }

  return <div aria-busy={state.status === 'loading'}>
    <PageTitle eyebrow="Directorio médico" title="Directorio médico" text="Busca profesionales por nombre o especialidad. Elegirás la fecha y la hora durante la reserva." />
    {state.status === 'ready' && data.doctors.length ? <div className="filter-bar"><SearchBox value={query} onChange={setQuery} label="Buscar por nombre o especialidad" /><div className="field compact-field"><label htmlFor="specialty-filter">Filtrar especialidad</label><select id="specialty-filter" value={effectiveFilter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todas</option>{data.specialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div> : null}
    {state.status === 'loading' ? <DirectoryLoading label="Cargando profesionales" /> : null}
    {state.status === 'error' ? <DirectoryError onRetry={retry} /> : null}
    {state.status === 'ready' && !data.doctors.length ? <EmptyDirectory kind="doctors" /> : null}
    {state.status === 'ready' && data.doctors.length && filtered.length ? <div className="doctor-grid">{filtered.map((doctor, index) => <article className="doctor-card" key={doctor.id}><div className={`doctor-avatar doctor-avatar--${index % 4}`}><span>{doctor.initials}</span><i aria-hidden="true" /></div><span className="demo-label">Perfil del directorio</span><h2>{doctor.name}</h2><p className="doctor-specialties">{doctor.specialtyIds.map((id) => specialtyNames.get(id)).filter(Boolean).join(' · ')}</p><p className="availability"><span aria-hidden="true" />Elige fecha y hora al reservar</p><Button onClick={() => select(doctor.id, doctor.specialtyIds)}>Reservar con este profesional <ArrowRight aria-hidden="true" /></Button></article>)}</div> : null}
    {state.status === 'ready' && data.doctors.length && !filtered.length ? <EmptySearch /> : null}
  </div>
}

function PageTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div> }
function SearchBox({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) { return <div className="search-box"><Search aria-hidden="true" /><label className="sr-only" htmlFor={label}>{label}</label><input id={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} type="search" /><DictationButton label={label.toLowerCase()} onTranscript={onChange} /></div> }
function DirectoryLoading({ label }: { label: string }) { return <div className="panel empty-state" role="status"><span className="eyebrow">Conectando con el directorio</span><h2>{label}…</h2><p>Esto puede tomar unos segundos.</p></div> }
function DirectoryError({ onRetry }: { onRetry: () => void }) { return <div className="empty-state" role="alert"><Stethoscope aria-hidden="true" /><h2>No pudimos cargar el directorio</h2><p>Comprueba tu conexión e inténtalo nuevamente.</p><Button onClick={onRetry}>Reintentar</Button></div> }
function EmptyDirectory({ kind }: { kind: 'specialties' | 'doctors' }) { return <div className="empty-state" role="status"><Stethoscope aria-hidden="true" /><h2>{kind === 'specialties' ? 'Aún no hay especialidades disponibles' : 'Aún no hay profesionales disponibles'}</h2><p>El directorio está conectado, pero todavía no contiene opciones activas.</p></div> }
function EmptySearch() { return <div className="empty-state" role="status"><Search aria-hidden="true" /><h2>Sin resultados</h2><p>Prueba con otro nombre o limpia el filtro.</p></div> }
