import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

describe('repository-config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
  })

  afterEach(() => {
    import.meta.env.VITE_REPOSITORY_MODE = undefined
    import.meta.env.VITE_SUPABASE_URL = undefined
    import.meta.env.VITE_SUPABASE_KEY = undefined
  })

  async function loadConfig() {
    const module = await import('./repository-config')
    return module
  }

  describe('isSupabaseConfigured', () => {
    it('should return true when both URL and KEY are set', async () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_KEY = 'test-key'

      const { isSupabaseConfigured } = await loadConfig()
      expect(isSupabaseConfigured()).toBe(true)
    })

    it('should return false when URL is missing', async () => {
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_KEY = 'test-key'

      const { isSupabaseConfigured } = await loadConfig()
      expect(isSupabaseConfigured()).toBe(false)
    })

    it('should return false when KEY is missing', async () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_KEY = ''

      const { isSupabaseConfigured } = await loadConfig()
      expect(isSupabaseConfigured()).toBe(false)
    })

    it('should return false when both are undefined', async () => {
      import.meta.env.VITE_SUPABASE_URL = undefined
      import.meta.env.VITE_SUPABASE_KEY = undefined

      const { isSupabaseConfigured } = await loadConfig()
      expect(isSupabaseConfigured()).toBe(false)
    })
  })

  describe('getEffectiveMode', () => {
    it('should return mock when mode is mock', async () => {
      import.meta.env.VITE_REPOSITORY_MODE = 'mock'

      const { getEffectiveMode } = await loadConfig()
      expect(getEffectiveMode()).toBe('mock')
    })

    it('should throw error when mode is supabase but not configured', async () => {
      import.meta.env.VITE_REPOSITORY_MODE = 'supabase'
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_KEY = ''

      const { getEffectiveMode } = await loadConfig()
      expect(() => getEffectiveMode()).toThrow()
    })

    it('should return supabase when mode is supabase and configured', async () => {
      import.meta.env.VITE_REPOSITORY_MODE = 'supabase'
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_KEY = 'test-key'

      const { getEffectiveMode } = await loadConfig()
      expect(getEffectiveMode()).toBe('supabase')
    })

    it('should return supabase in auto mode when configured', async () => {
      import.meta.env.VITE_REPOSITORY_MODE = 'auto'
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_KEY = 'test-key'

      const { getEffectiveMode } = await loadConfig()
      expect(getEffectiveMode()).toBe('supabase')
    })

    it('should return mock in auto mode when not configured', async () => {
      import.meta.env.VITE_REPOSITORY_MODE = 'auto'
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_KEY = ''

      const { getEffectiveMode } = await loadConfig()
      expect(getEffectiveMode()).toBe('mock')
    })
  })
})
