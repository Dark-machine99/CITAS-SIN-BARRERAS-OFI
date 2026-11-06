import { createFutureLimaDates, patientAvailabilityAdapter, type AvailabilitySlot, type PatientAvailabilityAdapter } from '../../services/supabase/patientAvailabilityAdapter'
import { patientDirectoryAdapter, type DirectoryDoctor, type DirectorySpecialty, type PatientDirectoryAdapter } from '../../services/supabase/patientDirectoryAdapter'
import type { AppointmentDraft } from '../../types/domain'
import { normalizeVoiceText, parseRequestedTime } from './voiceCommands'

export interface BookingProposal {
  draft: AppointmentDraft
  summary: string
  decisions: string[]
}

export type BookingResolution =
  | { status: 'proposal'; proposal: BookingProposal }
  | { status: 'clarification' | 'no-slots'; draft: AppointmentDraft; message: string; options: string[] }
  | { status: 'error'; draft: AppointmentDraft; message: string }

interface BookingResolverOptions {
  directoryAdapter?: PatientDirectoryAdapter
  availabilityAdapter?: PatientAvailabilityAdapter
  now?: Date
}

const requestWords = /\b(reservar|reserva|agendar|agenda|programar|pedir)\b.*\b(cita|consulta|turno)\b|\b(cita|consulta|turno)\b.*\b(reservar|reserva|agendar|agenda|programar|pedir)\b/
const bookingDetails = /\b(hoy|manana|fecha|dia|tarde|especialidad|cardiologia|neurologia|traumatologia|dermatologia|oftalmologia|medicina general|doctor|doctora|hora|dolor|molestia|control|revision|chequeo|fiebre|mareo|tos)\b/

function dateInLima(now: Date, offset: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return new Date(Date.UTC(read('year'), read('month') - 1, read('day') + offset)).toISOString().slice(0, 10)
}

function requestedDate(command: string, current: AppointmentDraft, now: Date) {
  const withoutPeriod = command.replace(/\b(?:por|en|de) la manana\b/g, '')
  if (/\bpasado manana\b/.test(withoutPeriod)) return { date: dateInLima(now, 2), inferred: false }
  if (/\bmanana\b/.test(withoutPeriod)) return { date: dateInLima(now, 1), inferred: false }
  if (/\bhoy\b/.test(command)) return { date: dateInLima(now, 0), inferred: false }
  const iso = command.match(/\b(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)\b/)
  if (iso) return { date: `${iso[1]!}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`, inferred: false }
  const short = command.match(/\b([0-3]?\d)[/]([01]?\d)(?:[/](20\d{2}))?\b/)
  if (short) return { date: `${short[3] ?? dateInLima(now, 0).slice(0, 4)}-${short[2]!.padStart(2, '0')}-${short[1]!.padStart(2, '0')}`, inferred: false }
  if (current.date) return { date: current.date, inferred: false }
  return { date: createFutureLimaDates(now, 1)[0]!, inferred: true }
}

function findSpecialties(command: string, specialties: DirectorySpecialty[]) {
  return specialties.filter((item) => {
    const name = normalizeVoiceText(item.name)
    const tokens = name.split(' ').filter((token) => token.length > 5)
    return command.includes(name) || tokens.some((token) => command.includes(token))
  })
}

function findDoctors(command: string, doctors: DirectoryDoctor[]) {
  const normalized = doctors.map((doctor) => ({
    doctor,
    name: normalizeVoiceText(doctor.name).replace(/\b(dra|dr|doctora|doctor)\b/g, '').trim(),
  }))
  const fullMatches = normalized.filter(({ name }) => command.includes(name))
  if (fullMatches.length) {
    return fullMatches.filter((candidate) => !fullMatches.some((other) => other.name.length > candidate.name.length && other.name.includes(candidate.name)))
      .map(({ doctor }) => doctor)
  }
  return normalized.filter(({ name }) => name.split(' ').some((part) => part.length > 4 && command.includes(part)))
    .map(({ doctor }) => doctor)
}

function periodSlots(command: string, slots: AvailabilitySlot[]) {
  const period = requestedPeriod(command)
  if (period === 'afternoon') return slots.filter((slot) => slot.time >= '12:00:00')
  if (period === 'morning') return slots.filter((slot) => slot.time < '12:00:00')
  return slots
}

function requestedPeriod(command: string) {
  if (/\b(?:por|en|de) la tarde\b|\bturno tarde\b/.test(command)) return 'afternoon' as const
  if (/\b(?:por|en|de) la manana\b|\bturno manana\b/.test(command)) return 'morning' as const
  return null
}

const timeOptions = (slots: AvailabilitySlot[]) => slots.slice(0, 4).map((slot) => `${slot.time.slice(0, 5)} (${slot.durationMinutes} minutos)`)

interface DoctorSlot {
  doctor: DirectoryDoctor
  doctorOrder: number
  slot: AvailabilitySlot
}

function orderedDoctorSlots(command: string, availability: { doctor: DirectoryDoctor; doctorOrder: number; slots: AvailabilitySlot[] }[]) {
  return availability.flatMap(({ doctor, doctorOrder, slots }) => periodSlots(command, slots).map((slot) => ({ doctor, doctorOrder, slot })))
    .toSorted((left, right) => left.slot.time.localeCompare(right.slot.time) || left.doctorOrder - right.doctorOrder)
}

function doctorTimeOptions(slots: DoctorSlot[]) {
  const seen = new Set<string>()
  return slots.flatMap(({ doctor, slot }) => {
    const key = `${doctor.id}:${slot.time}`
    if (seen.has(key)) return []
    seen.add(key)
    return [`${doctor.name}: ${slot.time.slice(0, 5)} (${slot.durationMinutes} minutos)`]
  }).slice(0, 4)
}

export function extractBookingReason(raw: string) {
  const match = raw.match(/\b(?:motivo(?: de consulta)?(?: es)?|porque|debido a|por)\s*[:,-]?\s*((?:dolor|molestia|control|revisi[oó]n|chequeo|ardor|fiebre|mareo|tos|malestar|lesi[oó]n|picaz[oó]n|visi[oó]n)[\s\S]+)/i)
  return match?.[1]?.trim().replace(/[. ]+$/, '').slice(0, 280) ?? ''
}

export function looksLikeFullBookingRequest(raw: string) {
  const command = normalizeVoiceText(raw)
  return requestWords.test(command) && bookingDetails.test(command)
}

export async function resolveBookingRequest(raw: string, current: AppointmentDraft, options: BookingResolverOptions = {}): Promise<BookingResolution> {
  const command = normalizeVoiceText(raw)
  const reason = extractBookingReason(raw) || current.reason
  const baseDraft = { ...current, reason }
  if (!command) return { status: 'error', draft: baseDraft, message: 'Escribe o dicta una solicitud antes de continuar.' }

  const directoryAdapter = options.directoryAdapter ?? patientDirectoryAdapter
  const availabilityAdapter = options.availabilityAdapter ?? patientAvailabilityAdapter
  let directory
  try { directory = await directoryAdapter.load() }
  catch { return { status: 'error', draft: baseDraft, message: 'No pudimos consultar el directorio médico. Inténtalo nuevamente.' } }

  const specialtyMatches = findSpecialties(command, directory.specialties)
  const currentSpecialty = directory.specialties.find((item) => item.id === current.specialtyId)
  if (specialtyMatches.length > 1) return {
    status: 'clarification', draft: { ...baseDraft, specialtyId: null, doctorId: null, time: null },
    message: 'Encontré varias especialidades. Indica una para continuar.', options: specialtyMatches.slice(0, 4).map((item) => item.name),
  }
  const specialty = specialtyMatches[0] ?? currentSpecialty
  if (!specialty) return {
    status: 'clarification', draft: { ...baseDraft, specialtyId: null, doctorId: null, time: null },
    message: 'Indica la especialidad que necesitas.', options: directory.specialties.slice(0, 4).map((item) => item.name),
  }

  const compatibleDoctors = directory.doctors.filter((doctor) => doctor.specialtyIds.includes(specialty.id))
  const namedDoctors = findDoctors(command, directory.doctors)
  const currentDoctor = compatibleDoctors.find((item) => item.id === current.doctorId)
  if (namedDoctors.length > 1) return {
    status: 'clarification', draft: { ...baseDraft, specialtyId: specialty.id, doctorId: null, time: null },
    message: 'Encontré varios profesionales con ese nombre. Indica el nombre completo para continuar.', options: namedDoctors.slice(0, 4).map((item) => item.name),
  }
  const namedDoctor = namedDoctors[0]
  if (namedDoctor && !namedDoctor.specialtyIds.includes(specialty.id)) return {
    status: 'clarification', draft: { ...baseDraft, specialtyId: specialty.id, doctorId: null, time: null },
    message: `${namedDoctor.name} no atiende ${specialty.name}. Elige un profesional compatible o cambia la especialidad.`,
    options: compatibleDoctors.slice(0, 4).map((item) => item.name),
  }
  const date = requestedDate(command, current, options.now ?? new Date())
  const exactTime = parseRequestedTime(command)
  const period = requestedPeriod(command)
  const doctor = namedDoctor ?? currentDoctor ?? (compatibleDoctors.length === 1 ? compatibleDoctors[0] : undefined)
  if (!doctor && !compatibleDoctors.length) return {
    status: 'clarification', draft: { ...baseDraft, specialtyId: specialty.id, doctorId: null, time: null },
    message: `No hay profesionales disponibles para ${specialty.name}.`, options: [],
  }
  if (!doctor && (exactTime || period)) {
    const partialDraft: AppointmentDraft = { specialtyId: specialty.id, doctorId: null, date: date.date, time: null, reason }
    let availability
    try {
      availability = await Promise.all(compatibleDoctors.map(async (candidate, doctorOrder) => ({
        doctor: candidate,
        doctorOrder,
        slots: (await availabilityAdapter.load({ doctorId: candidate.id, specialtyId: specialty.id, date: date.date })).slots,
      })))
    } catch {
      return { status: 'error', draft: partialDraft, message: 'No pudimos consultar los horarios. Inténtalo nuevamente.' }
    }

    const allSlots = orderedDoctorSlots('', availability)
    if (exactTime) {
      const exactCandidate = allSlots.find(({ slot }) => slot.time === exactTime)
      if (exactCandidate) return proposal(specialty, exactCandidate.doctor, date, exactCandidate.slot, reason, 'Elegí el profesional según el orden estable del directorio entre quienes tenían disponible la hora solicitada.')
      return {
        status: 'clarification', draft: partialDraft,
        message: `La hora ${exactTime.slice(0, 5)} no está disponible con los profesionales de ${specialty.name}. Elige una opción real.`,
        options: doctorTimeOptions(allSlots),
      }
    }

    const candidates = orderedDoctorSlots(command, availability)
    const selected = candidates[0]
    if (!selected) {
      const periodName = period === 'afternoon' ? 'la tarde' : 'la mañana'
      return {
        status: 'no-slots', draft: partialDraft,
        message: `No hay horarios disponibles por ${periodName} el ${date.date}. Elige otra fecha u horario.`,
        options: doctorTimeOptions(allSlots),
      }
    }
    const periodName = period === 'afternoon' ? 'la tarde' : 'la mañana'
    return proposal(specialty, selected.doctor, date, selected.slot, reason, `Seleccioné el horario más temprano de ${periodName}; en empates respeté el orden estable del directorio.`)
  }
  if (!doctor) return {
    status: 'clarification', draft: { ...baseDraft, specialtyId: specialty.id, doctorId: null, time: null },
    message: `Elige un profesional de ${specialty.name}.`, options: compatibleDoctors.slice(0, 4).map((item) => item.name),
  }

  const partialDraft: AppointmentDraft = { specialtyId: specialty.id, doctorId: doctor.id, date: date.date, time: null, reason }
  let availability
  try { availability = await availabilityAdapter.load({ doctorId: doctor.id, specialtyId: specialty.id, date: date.date }) }
  catch { return { status: 'error', draft: partialDraft, message: 'No pudimos consultar los horarios. Inténtalo nuevamente.' } }
  if (!availability.slots.length) return {
    status: 'no-slots', draft: partialDraft,
    message: `${doctor.name} no tiene horarios disponibles el ${date.date}. Indica otra fecha.`, options: [],
  }

  if (exactTime) {
    const exactSlot = availability.slots.find((slot) => slot.time === exactTime)
    if (!exactSlot) return {
      status: 'clarification', draft: partialDraft,
      message: `La hora ${exactTime.slice(0, 5)} no está disponible. Elige una de estas opciones.`, options: timeOptions(availability.slots),
    }
    return proposal(specialty, doctor, date, exactSlot, reason)
  }

  if (current.time) {
    const currentSlot = availability.slots.find((slot) => slot.time === current.time)
    if (currentSlot) return proposal(specialty, doctor, date, currentSlot, reason)
  }
  const candidates = periodSlots(command, availability.slots)
  if (candidates.length !== 1) return {
    status: 'clarification', draft: partialDraft,
    message: candidates.length ? 'Hay varios horarios disponibles. Indica una hora para continuar.' : 'No hay horarios en el periodo indicado. Elige otra hora.',
    options: timeOptions(candidates.length ? candidates : availability.slots),
  }
  return proposal(specialty, doctor, date, candidates[0]!, reason)
}

function proposal(specialty: DirectorySpecialty, doctor: DirectoryDoctor, date: { date: string; inferred: boolean }, slot: AvailabilitySlot, reason: string, automaticDecision?: string): BookingResolution {
  const draft: AppointmentDraft = { specialtyId: specialty.id, doctorId: doctor.id, date: date.date, time: slot.time, reason }
  return { status: 'proposal', proposal: {
    draft,
    summary: `Preparé ${specialty.name} con ${doctor.name}, el ${date.date} a las ${slot.time.slice(0, 5)}.`,
    decisions: [
      `Especialidad: ${specialty.name}.`, `Profesional: ${doctor.name}.`,
      date.inferred ? `Propuse la próxima fecha: ${date.date}.` : `Fecha solicitada: ${date.date}.`,
      `Horario disponible confirmado: ${slot.time.slice(0, 5)} (${slot.durationMinutes} minutos).`,
      ...(automaticDecision ? [automaticDecision] : []),
      reason ? 'Incluí el motivo indicado.' : 'No se indicó un motivo opcional.',
    ],
  } }
}
