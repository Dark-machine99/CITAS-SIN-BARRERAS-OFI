import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../app/providers/AuthProvider'
import { preferencesForPreset, toAccessibilityPreferencesUpdate, type AccessibilityPreset } from '../../app/providers/AccessibilityProvider'
import { DictationButton } from '../../components/assistive/DictationButton'
import { Button, ButtonLink } from '../../components/ui/Button'

type AuthKind = 'login' | 'register' | 'recover' | 'reset'
const content = {
  login: { eyebrow: 'Bienvenido de nuevo', title: 'Entra a tu espacio personal', submit: 'Ingresar' },
  register: { eyebrow: 'Solo para pacientes', title: 'Crea tu cuenta guiada', submit: 'Crear cuenta' },
  recover: { eyebrow: 'Recuperar acceso', title: 'Recibe instrucciones seguras', submit: 'Enviar instrucciones' },
  reset: { eyebrow: 'Nueva contraseña', title: 'Protege nuevamente tu cuenta', submit: 'Guardar contraseña' },
}

const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
  if (/invalid login credentials/i.test(message)) return 'El correo o la contraseña no coinciden.'
  if (/email not confirmed/i.test(message)) return 'Confirma primero tu correo desde el enlace que te enviamos.'
  if (/user already registered/i.test(message)) return 'Ya existe una cuenta con este correo.'
  if (/password/i.test(message) && /weak|least|short/i.test(message)) return 'La contraseña no cumple los requisitos de seguridad.'
  return message
}

export function AuthPage({ kind }: { kind: AuthKind }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [registrationPreset, setRegistrationPreset] = useState<AccessibilityPreset>('standard')
  const firstError = useRef<HTMLInputElement>(null)
  const meta = content[kind]
  const sessionEnded = (location.state as { sessionEnded?: 'manual' | 'timeout' } | null)?.sessionEnded
  const sessionNotice = kind === 'login' && sessionEnded
    ? sessionEnded === 'timeout'
      ? 'Cerramos tu sesión después de 15 minutos sin actividad para proteger tu información.'
      : 'Tu sesión se cerró y la información sensible no guardada se eliminó.'
    : null

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const firstName = String(form.get('firstName') ?? '').trim()
    const lastName = String(form.get('lastName') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    const next: Record<string, string> = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Escribe un correo con formato válido, por ejemplo nombre@correo.com.'
    if ((kind === 'login' || kind === 'register' || kind === 'reset') && password.length < 8) next.password = 'Usa al menos 8 caracteres.'
    if (kind === 'register' && !firstName) next.firstName = 'Escribe tu nombre.'
    if (kind === 'register' && !lastName) next.lastName = 'Escribe tu apellido.'
    if (kind === 'register' && !form.get('privacy')) next.privacy = 'Debes aceptar el aviso de privacidad para crear la cuenta.'
    setErrors(next); setFormError(null)
    if (Object.keys(next).length) { window.setTimeout(() => firstError.current?.focus(), 0); return }

    setBusy(true)
    try {
      if (kind === 'login') {
        const profile = await auth.signIn(email, password)
        if (profile.role !== 'patient') { navigate('/acceso-denegado', { replace: true }); return }
        const requested = (location.state as { from?: string } | null)?.from
        navigate(requested?.startsWith('/paciente') ? requested : '/paciente', { replace: true })
      } else if (kind === 'register') {
        const result = await auth.signUp({
          email,
          password,
          firstName,
          lastName,
          phone: phone || null,
          accessibilityPreferences: toAccessibilityPreferencesUpdate(preferencesForPreset(registrationPreset)),
        })
        navigate(result.status === 'authenticated' ? '/onboarding/accesibilidad' : '/confirmar-correo', { replace: true, state: result.status === 'confirmation-pending' ? { email } : undefined })
      } else if (kind === 'recover') {
        await auth.requestPasswordReset(email)
        navigate('/confirmar-correo?mode=recovery', { replace: true, state: { email } })
      } else {
        await auth.updatePassword(password)
        await auth.signOut()
        navigate('/login?password=updated', { replace: true })
      }
    } catch (nextError) {
      setFormError(friendlyError(nextError))
    } finally {
      setBusy(false)
    }
  }

  const needsPassword = kind === 'login' || kind === 'register' || kind === 'reset'
  return <section className="auth-page section-pad"><div className="auth-visual"><div className="auth-sculpture"><div className="shield-plate"><ShieldCheck /></div><span className="orbit-dot orbit-dot--one" /><span className="orbit-dot orbit-dot--two" /></div><h2>Diseñado para acompañarte</h2><p>Controles grandes, lenguaje claro y una experiencia que respeta tus preferencias.</p><ul><li><CheckCircle2 /> Navegación completa con teclado</li><li><CheckCircle2 /> Movimiento configurable</li><li><CheckCircle2 /> Perfil y preferencias personales</li></ul></div><div className="auth-card"><span className="eyebrow">{meta.eyebrow}</span><h1>{meta.title}</h1><p>{kind === 'register' ? 'Tus datos crearán una cuenta Paciente en el entorno cloud de pruebas.' : 'Usa los datos de tu cuenta Paciente.'}</p>{sessionNotice ? <div className="notice notice--neutral" role="status">{sessionNotice}</div> : null}{formError ? <div className="notice notice--error" role="alert">{formError}</div> : null}<form onSubmit={(event) => void submit(event)} noValidate>
    {kind === 'register' ? <><div className="field-row"><Field ref={errors.firstName ? firstError : undefined} label="Nombre" name="firstName" icon={<UserRound />} error={errors.firstName} required autoComplete="given-name" /><Field ref={errors.lastName ? firstError : undefined} label="Apellido" name="lastName" icon={<UserRound />} error={errors.lastName} required autoComplete="family-name" /></div><Field label="Teléfono (opcional)" name="phone" type="tel" icon={<Phone />} autoComplete="tel" /></> : null}
    <Field ref={errors.email ? firstError : undefined} label="Correo" name="email" type="email" icon={<Mail />} error={errors.email} required autoComplete="email" />
    {needsPassword ? <div className="field"><label htmlFor="password">{kind === 'reset' ? 'Nueva contraseña' : 'Contraseña'}</label><div className="input-shell"><LockKeyhole aria-hidden="true" /><input ref={errors.password ? firstError : undefined} id="password" name="password" type={showPassword ? 'text' : 'password'} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : 'password-help'} autoComplete={kind === 'login' ? 'current-password' : 'new-password'} /><DictationButton label="contraseña" targetId="password" /><button type="button" className="input-action" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff /> : <Eye />}</button></div><small id="password-help">Mínimo 8 caracteres. Evita decirla en voz alta si hay otras personas cerca.</small>{errors.password ? <span className="field-error" id="password-error">{errors.password}</span> : null}</div> : null}
    {kind === 'register' ? <><div className="field"><label htmlFor="registration-preset">Perfil de accesibilidad inicial</label><select id="registration-preset" value={registrationPreset} onChange={(event) => setRegistrationPreset(event.target.value as AccessibilityPreset)}><option value="standard">Estándar</option><option value="low-vision">Baja visión</option><option value="reduced-mobility">Movilidad reducida</option><option value="colorblind">Daltonismo</option><option value="focus">Concentración</option><option value="older-adult">Adulto mayor</option></select><small>Podrás personalizar cada ajuste después de crear tu cuenta.</small></div><label className="check-row"><input type="checkbox" name="privacy" /><span>Acepto el <Link to="/privacidad">aviso de privacidad</Link>.</span></label>{errors.privacy ? <span className="field-error">{errors.privacy}</span> : null}</> : null}
    <Button type="submit" loading={busy} className="button--full">{meta.submit}</Button>
  </form>
  <div className="auth-links">{kind === 'login' ? <><Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link><span>¿Primera vez? <Link to="/registro">Crear una cuenta</Link></span><Link to="/acceso-demo">Ver otros roles demo</Link></> : <Link to="/login">Volver al ingreso</Link>}</div></div></section>
}

function Field({ label, name, type = 'text', icon, error, ...props }: { label: string; name: string; type?: string; icon: React.ReactNode; error?: string } & React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  const { ref, ...inputProps } = props
  return <div className="field"><label htmlFor={name}>{label}</label><div className="input-shell">{icon}<input ref={ref} id={name} name={name} type={type} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} {...inputProps} /><DictationButton label={label.toLowerCase()} targetId={name} format={type === 'email' ? 'email' : 'plain'} /></div>{error ? <span className="field-error" id={`${name}-error`}>{error}</span> : null}</div>
}

export function ConfirmEmailPage() {
  const auth = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const email = (location.state as { email?: string } | null)?.email
  const recovery = searchParams.get('mode') === 'recovery'
  const ready = !recovery && auth.status === 'authenticated' && auth.profile?.role === 'patient'
  return <section className="confirmation-page section-pad"><div className="confirmation-orb"><Mail /></div><span className="eyebrow">{ready ? 'Sesión activa' : 'Revisa tu correo'}</span><h1>{ready ? 'Tu cuenta ya está lista' : recovery ? 'Te enviamos instrucciones de recuperación' : 'Confirma tu cuenta antes de ingresar'}</h1><p>{ready ? 'Tu sesión y tu perfil Paciente están disponibles. Puedes continuar con la configuración de accesibilidad.' : <>Abre el enlace enviado{email ? <> a <strong>{email}</strong></> : null}. No podrás acceder al espacio Paciente hasta completar este paso.</>}</p><div className="button-row">{ready ? <ButtonLink to="/onboarding/accesibilidad">Configurar accesibilidad</ButtonLink> : <ButtonLink to="/login">Volver al ingreso</ButtonLink>}<ButtonLink to="/accesibilidad" variant="secondary">Explorar accesibilidad</ButtonLink></div></section>
}
