import { CheckCircle2, KeyRound, Mail, Phone, Save, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../app/providers/AuthProvider'
import { DictationButton } from '../../components/assistive/DictationButton'
import { Button, ButtonLink } from '../../components/ui/Button'

export function ProfilePage() {
  const auth = useAuth()
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState({ firstName: '', lastName: '', phone: '' })
  useEffect(() => {
    if (auth.profile) setValues({ firstName: auth.profile.first_name, lastName: auth.profile.last_name, phone: auth.profile.phone ?? '' })
  }, [auth.profile])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setSaved(false); setError(null)
    try {
      await auth.updateProfile({ first_name: values.firstName.trim(), last_name: values.lastName.trim(), phone: values.phone.trim() || null })
      setSaved(true)
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'No se pudo actualizar el perfil.') }
    finally { setBusy(false) }
  }
  const fullName = `${auth.profile?.first_name ?? ''} ${auth.profile?.last_name ?? ''}`.trim()
  const initials = `${auth.profile?.first_name?.[0] ?? 'P'}${auth.profile?.last_name?.[0] ?? ''}`.toUpperCase()
  return <div><div className="page-heading"><span className="eyebrow">Cuenta Paciente</span><h1>Mi perfil</h1><p>Actualiza tus datos personales. Los cambios se guardan en tu perfil protegido.</p></div>{saved ? <div className="notice notice--success" role="status"><CheckCircle2 />Cambios guardados correctamente.</div> : null}{error ? <div className="notice notice--error" role="alert">{error}</div> : null}<div className="profile-grid"><form className="panel profile-form" onSubmit={(event) => void submit(event)}><div className="profile-avatar"><span>{initials}</span><div><h2>{fullName || 'Paciente'}</h2><p>Perfil personal verificado</p></div></div><div className="field-row"><ProfileField label="Nombre" name="firstName" value={values.firstName} onChange={(value) => setValues((current) => ({ ...current, firstName: value }))} icon={<UserRound />} /><ProfileField label="Apellido" name="lastName" value={values.lastName} onChange={(value) => setValues((current) => ({ ...current, lastName: value }))} icon={<UserRound />} /></div><ProfileField label="Teléfono" name="phone" value={values.phone} onChange={(value) => setValues((current) => ({ ...current, phone: value }))} icon={<Phone />} /><Button type="submit" loading={busy}><Save />Guardar cambios</Button></form><aside className="panel account-panel"><h2>Cuenta y seguridad</h2><div className="account-item"><span><Mail /></span><div><strong>{auth.session?.user.email ?? 'Correo no disponible'}</strong><small>Correo de acceso confirmado por Supabase Auth</small></div></div><div className="account-item"><span><KeyRound /></span><div><strong>Contraseña</strong><small>Puedes solicitar un cambio seguro desde el flujo de recuperación.</small></div></div><ButtonLink to="/recuperar-contrasena" variant="secondary">Cambiar contraseña</ButtonLink><div className="notice notice--neutral">Tu identidad se valida en el servidor antes de mostrar este espacio.</div></aside></div></div>
}

function ProfileField({ label, name, value, onChange, icon }: { label: string; name: string; value: string; onChange: (value: string) => void; icon: React.ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}</label><div className="input-shell">{icon}<input id={name} name={name} value={value} onChange={(event) => onChange(event.target.value)} required={name !== 'phone'} /><DictationButton label={label.toLowerCase()} targetId={name} /></div></div>
}
