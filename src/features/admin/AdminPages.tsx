import { Activity, AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, Clock3, Edit3, Plus, Search, ShieldCheck, Stethoscope, Tags, UserRoundCheck, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useMedicalAdminDemo } from '../../app/providers/MedicalAdminDemoProvider'
import { DictationButton } from '../../components/assistive/DictationButton'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge, statusLabel } from '../../components/ui/StatusBadge'
import { adminAppointmentAdapter, adminUserDirectoryAdapter } from '../../services/mock/medicalAdminAdapters'
import type { AppointmentStatus } from '../../types/domain'
import type { AdminSpecialtyDTO } from '../../types/medicalAdmin'

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const formatDate = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
const doctorLabel = (id: string, doctors: ReturnType<typeof useMedicalAdminDemo>['doctors']) => { const doctor = doctors.find((item) => item.id === id); return doctor ? `${doctor.first_name} ${doctor.last_name}` : 'Profesional no disponible' }
const specialtyLabel = (id: string, specialties: ReturnType<typeof useMedicalAdminDemo>['specialties']) => specialties.find((item) => item.id === id)?.name ?? 'Especialidad no disponible'

function AdminHeading({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: typeof Activity }) {
  return <header className="role-page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="role-heading-scene" aria-hidden="true"><Icon /><span /><i /></div></header>
}

export function AdminDashboardPage() {
  const store = useMedicalAdminDemo()
  const items = adminAppointmentAdapter.list(store)
  const today = items.filter((item) => item.appointment_date === '2026-10-23')
  const cards = [
    ['Citas de hoy', today.length, CalendarDays, 'blue'],
    ['Atendidas', items.filter((item) => item.status === 'attended').length, Clock3, 'amber'],
    ['Confirmadas', items.filter((item) => item.status === 'confirmed').length, CheckCircle2, 'mint'],
    ['Canceladas', items.filter((item) => item.status === 'cancelled').length, AlertTriangle, 'rose'],
    ['Profesionales activos', store.doctors.filter((item) => item.active).length, Stethoscope, 'lavender'],
  ] as const
  return <section><AdminHeading eyebrow="Coordinación · fuente mock" title="Resumen operativo" description="Indicadores sintéticos para recorrer el panel sin exponer información clínica." icon={Activity} /><div className="metric-grid admin-metric-grid">{cards.map(([label, value, Icon, tone]) => <article key={label} className={`metric-card metric-card--${tone}`}><span className="metric-icon"><Icon /></span><div><small>{label}</small><strong>{value}</strong><em>Dato simulado</em></div></article>)}</div><div className="dashboard-grid"><article className="panel role-panel"><div className="panel__header"><div><span className="demo-label">Hoy · 23 oct. 2026</span><h2>Actividad prevista</h2></div></div><div className="compact-timeline">{today.map((item) => <div key={item.id}><time>{item.start_time}</time><span><strong>{specialtyLabel(item.specialty_id, store.specialties)}</strong><small>{doctorLabel(item.doctor_id, store.doctors)} · {item.code}</small></span><StatusBadge status={item.status} /></div>)}</div></article><aside className="panel privacy-card"><ShieldCheck /><h2>Vista de mínima exposición</h2><p>Este resumen administrativo no contiene nombres de pacientes, motivos de consulta ni datos clínicos.</p><ul><li>Mocks locales y volátiles</li><li>Sin conexión a servicios</li><li>Sin persistencia al recargar</li></ul></aside></div></section>
}

export function AdminDoctorsPage() {
  const store = useMedicalAdminDemo()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const filtered = store.doctors.filter((item) => `${item.first_name} ${item.last_name} ${item.email}`.toLowerCase().includes(query.toLowerCase()))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    const specialtyIds = form.getAll('specialties').map(String)
    const input = { first_name: String(form.get('firstName') ?? '').trim(), last_name: String(form.get('lastName') ?? '').trim(), email: String(form.get('email') ?? '').trim(), specialty_ids: specialtyIds }
    if (!input.first_name || !input.last_name || !/^\S+@\S+\.\S+$/.test(input.email) || !specialtyIds.length) { setError('Completa nombres, un correo válido y al menos una especialidad.'); return }
    const result = store.addDoctor(input)
    if (!result.ok) { setError('Conflicto 409 simulado: ya existe un profesional con ese correo.'); return }
    setOpen(false); setError(''); setFeedback('Profesional creado solo en la memoria de esta demo.')
  }
  return <section><AdminHeading eyebrow="ADM-02 · directorio demo" title="Profesionales" description="Gestiona disponibilidad operativa sin contraseñas ni privilegios de backend." icon={Stethoscope} /><div className="panel role-panel"><div className="admin-toolbar"><label className="search-box"><Search /><span className="sr-only">Buscar profesionales</span><input id="admin-doctor-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o correo demo" /><DictationButton label="búsqueda de profesionales" targetId="admin-doctor-search" /></label><Button onClick={() => setOpen(true)}><Plus />Nuevo profesional</Button></div>{feedback ? <p className="notice notice--success" role="status">{feedback}</p> : null}<div className="responsive-table"><table><caption className="sr-only">Directorio de profesionales de demostración</caption><thead><tr><th>Profesional</th><th>Correo demo</th><th>Especialidades</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.first_name} {item.last_name}</strong></td><td>{item.email}</td><td>{item.specialty_ids.map((id) => specialtyLabel(id, store.specialties)).join(', ')}</td><td><span className={`availability-pill ${item.active ? 'is-active' : ''}`}>{item.active ? 'Activo' : 'Inactivo'}</span></td><td><Button variant="ghost" onClick={() => store.toggleDoctor(item.id)}>{item.active ? 'Desactivar' : 'Reactivar'}</Button></td></tr>)}</tbody></table></div></div><Modal open={open} title="Nuevo profesional demo" onClose={() => setOpen(false)}><form onSubmit={submit} noValidate><div className="field-row"><AdminField id="doctor-first-name" name="firstName" label="Nombres" /><AdminField id="doctor-last-name" name="lastName" label="Apellidos" /></div><AdminField id="doctor-email" name="email" label="Correo de demostración" type="email" /><fieldset className="checkbox-fieldset"><legend>Especialidades</legend>{store.specialties.filter((item) => item.active).map((item) => <label key={item.id}><input type="checkbox" name="specialties" value={item.id} />{item.name}</label>)}</fieldset>{error ? <p className="notice notice--error" role="alert">{error}</p> : null}<p className="form-boundary">No se solicita contraseña ni rol. El alta real requerirá una función administrativa segura.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Crear en demo</Button></div></form></Modal></section>
}

export function AdminSpecialtiesPage() {
  const store = useMedicalAdminDemo()
  const [editing, setEditing] = useState<AdminSpecialtyDTO | 'new' | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); store.saveSpecialty({ id: editing && editing !== 'new' ? editing.id : undefined, name: String(data.get('name') ?? ''), description: String(data.get('description') ?? '') }); setEditing(null) }
  return <section><AdminHeading eyebrow="ADM-03 · catálogo demo" title="Especialidades" description="Edita la oferta visible; las bajas son lógicas para conservar referencias." icon={Tags} /><div className="admin-card-grid">{store.specialties.map((item) => <article className="catalog-card" key={item.id}><div className="catalog-orb"><Tags /></div><div><span className={`availability-pill ${item.active ? 'is-active' : ''}`}>{item.active ? 'Activa' : 'Inactiva'}</span><h2>{item.name}</h2><p>{item.description}</p></div><div className="button-row"><Button variant="secondary" onClick={() => setEditing(item)}><Edit3 />Editar</Button><Button variant="ghost" onClick={() => store.toggleSpecialty(item.id)}>{item.active ? 'Desactivar' : 'Reactivar'}</Button></div></article>)}</div><Button className="floating-page-action" onClick={() => setEditing('new')}><Plus />Nueva especialidad</Button><Modal open={!!editing} title={editing === 'new' ? 'Nueva especialidad demo' : 'Editar especialidad'} onClose={() => setEditing(null)}><form onSubmit={submit}><AdminField id="specialty-name" name="name" label="Nombre" defaultValue={editing && editing !== 'new' ? editing.name : ''} /><div className="field"><label htmlFor="specialty-description">Descripción</label><div className="input-shell input-shell--textarea"><textarea id="specialty-description" name="description" defaultValue={editing && editing !== 'new' ? editing.description : ''} required /><DictationButton label="descripción de especialidad" targetId="specialty-description" /></div></div><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit">Guardar en demo</Button></div></form></Modal></section>
}

export function AdminAvailabilityPage() {
  const store = useMedicalAdminDemo()
  const [message, setMessage] = useState('')
  const submitSchedule = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const start = String(data.get('start')); const end = String(data.get('end')); if (start >= end) { setMessage('La hora final debe ser posterior a la inicial.'); return } store.saveAvailability({ doctor_id: String(data.get('doctor')), weekday: Number(data.get('weekday')), start_time: start, end_time: end }); setMessage('Horario agregado en la demo.') }
  const submitException = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const fullDay = data.get('fullDay') === 'on'; store.addException({ doctor_id: String(data.get('doctor')), date: String(data.get('date')), type: String(data.get('type')) as 'blocked' | 'available_override', start_time: fullDay ? null : String(data.get('start')), end_time: fullDay ? null : String(data.get('end')) }); setMessage('Excepción agregada en la demo.') }
  return <section><AdminHeading eyebrow="ADM-04 · disponibilidad" title="Horarios y excepciones" description="Configura una semana base y ajustes puntuales. La zona horaria real está pendiente." icon={CalendarClock} />{message ? <p className={`notice ${message.includes('posterior') ? 'notice--error' : 'notice--success'}`} role="status">{message}</p> : null}<div className="schedule-layout"><article className="panel role-panel"><h2>Semana habitual</h2><form className="inline-admin-form" onSubmit={submitSchedule}><SelectDoctor doctors={store.doctors} /><label>Día<select name="weekday" defaultValue="1">{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Desde<input name="start" type="time" defaultValue="08:00" /></label><label>Hasta<input name="end" type="time" defaultValue="13:00" /></label><Button type="submit"><Plus />Agregar tramo</Button></form><div className="schedule-list">{store.availability.map((item) => <div key={item.id}><span>{weekdays[item.weekday]}</span><strong>{item.start_time}–{item.end_time}</strong><small>{doctorLabel(item.doctor_id, store.doctors)}</small></div>)}</div></article><article className="panel role-panel"><h2>Excepciones</h2><form className="exception-form" onSubmit={submitException}><SelectDoctor doctors={store.doctors} /><label>Fecha<input name="date" type="date" defaultValue="2026-10-27" required /></label><label>Tipo<select name="type"><option value="blocked">Bloqueo</option><option value="available_override">Disponibilidad adicional</option></select></label><label className="check-row"><input name="fullDay" type="checkbox" defaultChecked />Día completo</label><div className="field-row"><label>Desde<input name="start" type="time" defaultValue="09:00" /></label><label>Hasta<input name="end" type="time" defaultValue="12:00" /></label></div><Button type="submit"><Plus />Agregar excepción</Button></form><div className="exception-list">{store.exceptions.map((item) => <div key={item.id}><span className={`availability-pill ${item.type === 'available_override' ? 'is-active' : ''}`}>{item.type === 'blocked' ? 'Bloqueo' : 'Disponible'}</span><strong>{formatDate(item.date)}</strong><small>{doctorLabel(item.doctor_id, store.doctors)} · {item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : 'Día completo'}</small></div>)}</div></article></div></section>
}

export function AdminAppointmentsPage() {
  const store = useMedicalAdminDemo(); const appointments = adminAppointmentAdapter.list(store)
  const [status, setStatus] = useState<AppointmentStatus | 'all'>('all')
  const filtered = appointments.filter((item) => status === 'all' || item.status === status)
  return <section><AdminHeading eyebrow="ADM-05 · proyección mínima" title="Citas globales" description="Vista operativa sin paciente, motivo ni información clínica." icon={CalendarDays} /><div className="panel role-panel"><div className="admin-toolbar"><label className="compact-field">Estado<select value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus | 'all')}><option value="all">Todos</option>{(['confirmed', 'attended', 'no_show', 'cancelled'] as const).map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></label><p className="privacy-inline"><ShieldCheck /> El adaptador elimina campos no autorizados.</p></div><div className="responsive-table"><table><caption className="sr-only">Citas administrativas con datos mínimos</caption><thead><tr><th>Código</th><th>Fecha y hora</th><th>Profesional</th><th>Especialidad</th><th>Duración</th><th>Estado</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.code}</strong></td><td>{formatDate(item.appointment_date)} · {item.start_time}</td><td>{doctorLabel(item.doctor_id, store.doctors)}</td><td>{specialtyLabel(item.specialty_id, store.specialties)}</td><td>{item.duration_minutes} min</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></div></section>
}

export function AdminUsersPage() {
  const store = useMedicalAdminDemo(); const users = adminUserDirectoryAdapter.list(store)
  const [query, setQuery] = useState('')
  const visible = users.filter((item) => `${item.first_name} ${item.last_name} ${item.role}`.toLowerCase().includes(query.toLowerCase()))
  return <section><AdminHeading eyebrow="ADM-06 · solo lectura" title="Directorio de usuarios" description="Perfiles mínimos de pacientes y médicos, sin datos de contacto ni preferencias." icon={UsersRound} /><div className="panel role-panel"><div className="admin-toolbar"><label className="search-box"><Search /><span className="sr-only">Buscar usuarios</span><input id="admin-user-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o rol" /><DictationButton label="búsqueda de usuarios" targetId="admin-user-search" /></label><span className="read-only-badge"><UserRoundCheck /> Solo lectura</span></div><div className="responsive-table"><table><caption className="sr-only">Directorio mínimo de usuarios</caption><thead><tr><th>Identificador demo</th><th>Nombre</th><th>Apellido</th><th>Rol</th></tr></thead><tbody>{visible.map((item) => <tr key={item.profile_id}><td><code>{item.profile_id}</code></td><td>{item.first_name}</td><td>{item.last_name}</td><td>{item.role === 'patient' ? 'Paciente' : 'Médico'}</td></tr>)}</tbody></table></div></div></section>
}

function AdminField({ id, label, type = 'text', ...props }: { id: string; label: string; type?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div className="field"><label htmlFor={id}>{label}</label><div className="input-shell"><input id={id} type={type} {...props} /><DictationButton label={label.toLowerCase()} targetId={id} format={type === 'email' ? 'email' : 'plain'} /></div></div>
}

function SelectDoctor({ doctors }: { doctors: ReturnType<typeof useMedicalAdminDemo>['doctors'] }) {
  return <label>Profesional<select name="doctor">{doctors.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}</select></label>
}
