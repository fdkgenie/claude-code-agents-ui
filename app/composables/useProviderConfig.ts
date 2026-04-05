// app/composables/useProviderConfig.ts
import type { ProviderConfig, ProviderEntry } from '~/types'

export function useProviderConfig() {
  const config = useState<ProviderConfig | null>('providerConfig', () => null)
  const selectedProvider = useState<string>('selectedProvider', () => 'claude')
  const loading = useState('providerConfigLoading', () => false)

  async function load() {
    loading.value = true
    try {
      const data = await $fetch<ProviderConfig>('/api/v2/providers/config')
      config.value = data
      selectedProvider.value = data.defaultProvider
    }
    finally {
      loading.value = false
    }
  }

  /** Save/update the custom provider entry (entry.name will be forced to 'custom') */
  async function saveCustomEntry(entry: Omit<ProviderEntry, 'name' | 'builtIn'>) {
    loading.value = true
    try {
      await $fetch('/api/v2/providers/config', {
        method: 'PUT',
        body: { entry: { ...entry, name: 'custom' } },
      })
      await load()
    }
    finally {
      loading.value = false
    }
  }

  /** Delete the custom provider and reset default to 'claude' */
  async function removeCustomProvider() {
    loading.value = true
    try {
      await $fetch('/api/v2/providers/custom', { method: 'DELETE' })
      await load()
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Switch the active provider and persist it as default.
   * Does NOT touch the custom entry details.
   */
  async function switchProvider(providerName: string) {
    selectedProvider.value = providerName
    await $fetch('/api/v2/providers/config', {
      method: 'PUT',
      body: { defaultProvider: providerName },
    })
  }

  const customEntry = computed(
    () => config.value?.providers.find(p => p.name === 'custom' && !p.builtIn) ?? null,
  )

  const hasCustomProvider = computed(() => !!customEntry.value)

  const providers = computed(() => config.value?.providers ?? [])

  return {
    config,
    selectedProvider,
    loading,
    load,
    saveCustomEntry,
    removeCustomProvider,
    switchProvider,
    customEntry,
    hasCustomProvider,
    providers,
  }
}
