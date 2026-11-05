import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookingProvider, useBooking } from '../app/providers/BookingProvider'
import type { PatientReservationAdapter, PatientReservationData } from '../services/supabase/patientReservationAdapter'

const reservation: PatientReservationData = {
  id: '33333333-3333-4333-8333-333333333333',
  code: 'CMA-OPACO-01',
  doctorId: '11111111-1111-4111-8111-111111111111',
  specialtyId: '22222222-2222-4222-8222-222222222222',
  date: '2026-10-31',
  time: '09:30:00',
  durationMinutes: 45,
  status: 'confirmed',
}

function ConfirmationHarness() {
  const { appointments, confirm, updateDraft } = useBooking()
  const [result, setResult] = useState('idle')
  const confirmTwice = async () => {
    const first = confirm()
    const second = confirm()
    const [firstResult, secondResult] = await Promise.all([first, second])
    setResult(`${first === second}:${firstResult.ok ? firstResult.appointment.code : firstResult.code}:${secondResult.ok ? secondResult.appointment.code : secondResult.code}`)
  }
  return <>
    <button type="button" onClick={() => updateDraft({ doctorId: reservation.doctorId, specialtyId: reservation.specialtyId, date: reservation.date, time: reservation.time, reason: ' Control ' })}>preparar</button>
    <button type="button" onClick={() => void confirmTwice()}>confirmar dos veces</button>
    <output data-testid="confirmation-result">{result}</output>
    <output data-testid="appointment-count">{appointments.length}</output>
  </>
}

afterEach(cleanup)

describe('confirmación única en BookingProvider', () => {
  it('comparte la promesa en vuelo, llama una sola vez y no finge un listado cloud', async () => {
    let resolveReservation!: (value: PatientReservationData) => void
    const pending = new Promise<PatientReservationData>((resolve) => { resolveReservation = resolve })
    const reservationAdapter: PatientReservationAdapter = { reserve: vi.fn().mockReturnValue(pending) }
    const user = userEvent.setup()
    render(<BookingProvider reservationAdapter={reservationAdapter}><ConfirmationHarness /></BookingProvider>)
    const initialCount = screen.getByTestId('appointment-count').textContent

    await user.click(screen.getByRole('button', { name: 'preparar' }))
    await user.click(screen.getByRole('button', { name: /confirmar dos veces/i }))

    expect(reservationAdapter.reserve).toHaveBeenCalledTimes(1)
    expect(reservationAdapter.reserve).toHaveBeenCalledWith({
      doctorId: reservation.doctorId,
      specialtyId: reservation.specialtyId,
      date: reservation.date,
      time: reservation.time,
      reason: ' Control ',
    })
    resolveReservation(reservation)
    await waitFor(() => expect(screen.getByTestId('confirmation-result')).toHaveTextContent('true:CMA-OPACO-01:CMA-OPACO-01'))
    expect(screen.getByTestId('appointment-count')).toHaveTextContent(initialCount ?? '')
  })
})
