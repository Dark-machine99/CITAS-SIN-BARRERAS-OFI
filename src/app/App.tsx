import { Route, Routes } from 'react-router'
import { PatientLayout } from '../components/layout/PatientLayout'
import { PublicLayout } from '../components/layout/PublicLayout'
import { RoleLayout } from '../components/layout/RoleLayout'
import { AdminAppointmentsPage, AdminAvailabilityPage, AdminDashboardPage, AdminDoctorsPage, AdminSpecialtiesPage, AdminUsersPage } from '../features/admin/AdminPages'
import { AccessibilityPage } from '../features/accessibility/AccessibilityPage'
import { AppointmentDetailPage, AppointmentsPage } from '../features/appointments/AppointmentsPages'
import { AuthPage, ConfirmEmailPage } from '../features/auth/AuthPages'
import { DemoRoleAccessPage } from '../features/auth/DemoRoleAccessPage'
import { RequirePatient } from '../features/auth/RequirePatient'
import { BookingPage } from '../features/booking/BookingPage'
import { DashboardPage } from '../features/patient/DashboardPage'
import { DoctorsPage, SpecialtiesPage } from '../features/patient/DirectoryPages'
import { ProfilePage } from '../features/patient/ProfilePage'
import { DoctorAgendaPage, DoctorAppointmentDetailPage, DoctorPasswordPage } from '../features/doctor/DoctorPages'
import { LandingPage } from '../features/public/LandingPage'
import { PrivacyPage } from '../features/public/PrivacyPage'
import { ForbiddenPage, NotFoundPage } from '../features/public/SystemPages'

export function App() {
  return <Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage kind="login" />} />
      <Route path="/registro" element={<AuthPage kind="register" />} />
      <Route path="/recuperar-contrasena" element={<AuthPage kind="recover" />} />
      <Route path="/nueva-contrasena" element={<AuthPage kind="reset" />} />
      <Route path="/confirmar-correo" element={<ConfirmEmailPage />} />
      <Route path="/onboarding/accesibilidad" element={<AccessibilityPage onboarding />} />
      <Route path="/privacidad" element={<PrivacyPage />} />
      <Route path="/accesibilidad" element={<AccessibilityPage />} />
      <Route path="/acceso-denegado" element={<ForbiddenPage />} />
      <Route path="/acceso-demo" element={<DemoRoleAccessPage />} />
    </Route>
    <Route path="/medico" element={<RoleLayout appRole="doctor" />}>
      <Route index element={<DoctorAgendaPage />} />
      <Route path="cambiar-contrasena" element={<DoctorPasswordPage />} />
      <Route path="citas/:id" element={<DoctorAppointmentDetailPage />} />
    </Route>
    <Route path="/administracion" element={<RoleLayout appRole="admin" />}>
      <Route index element={<AdminDashboardPage />} />
      <Route path="medicos" element={<AdminDoctorsPage />} />
      <Route path="especialidades" element={<AdminSpecialtiesPage />} />
      <Route path="horarios" element={<AdminAvailabilityPage />} />
      <Route path="citas" element={<AdminAppointmentsPage />} />
      <Route path="usuarios" element={<AdminUsersPage />} />
    </Route>
    <Route element={<RequirePatient />}>
      <Route path="/paciente" element={<PatientLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="reservar" element={<BookingPage />} />
        <Route path="citas" element={<AppointmentsPage />} />
        <Route path="citas/:id" element={<AppointmentDetailPage />} />
        <Route path="medicos" element={<DoctorsPage />} />
        <Route path="especialidades" element={<SpecialtiesPage />} />
        <Route path="accesibilidad" element={<AccessibilityPage authenticated />} />
        <Route path="perfil" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="*" element={<PublicLayout />}><Route path="*" element={<NotFoundPage />} /></Route>
  </Routes>
}
