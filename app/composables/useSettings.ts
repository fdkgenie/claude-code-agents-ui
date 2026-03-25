import type { Settings } from '~/types'

export function useSettings() {
  const settings = useState<Settings | null>('settings', () => null)
  const loading = useState('settingsLoading', () => false)
  const error = useState<string | null>('settingsError', () => null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      settings.value = await $fetch<Settings>('/api/settings')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load settings'
      error.value = msg
      console.error('[useSettings] load:', msg)
    } finally {
      loading.value = false
    }
  }

  async function save(data: Settings) {
    settings.value = await $fetch<Settings>('/api/settings', { method: 'PUT', body: data })
  }

  return { settings, loading, error, load, save }
}
