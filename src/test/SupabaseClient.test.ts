import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn((..._args: unknown[]) => ({ auth: {} })) }))

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

describe('cliente Supabase del navegador', () => {
  beforeEach(() => {
    createClientMock.mockClear()
    vi.resetModules()
  })

  it('persiste la sesión únicamente durante la vida de la pestaña', async () => {
    await import('../lib/supabase')

    expect(createClientMock).toHaveBeenCalledTimes(1)
    expect(createClientMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({
          storage: window.sessionStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }),
      }),
    )
    const options = createClientMock.mock.calls[0]?.[2] as { auth?: { storage?: unknown } } | undefined
    expect(options?.auth?.storage).not.toBe(window.localStorage)
  })
})
