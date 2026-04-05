// server/api/v2/providers/config.put.ts
import { providerRegistry } from '../../../utils/providers/registry'
import { getProviderConfig, saveProviderConfig } from '../../../utils/providers/providerConfig'
import { CustomAnthropicProvider, customProviderInfo } from '../../../utils/providers/customProvider'
import type { ProviderEntry } from '../../../utils/providers/providerConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ entry?: ProviderEntry; defaultProvider?: string }>(event)

  const config = await getProviderConfig()

  if (body.entry) {
    // Sentinel: '__unchanged__' means keep existing auth token
    if (body.entry.authToken === '__unchanged__') {
      const existing = config.providers.find(p => p.name === 'custom')
      body.entry.authToken = existing?.authToken
    }

    const idx = config.providers.findIndex(p => p.name === 'custom')
    const entry: ProviderEntry = { ...body.entry, name: 'custom' }
    if (idx >= 0) {
      config.providers[idx] = entry
    }
    else {
      config.providers.push(entry)
    }

    // Re-register in registry
    if (entry.baseUrl && entry.authToken) {
      providerRegistry.register(new CustomAnthropicProvider(entry), customProviderInfo(entry))
    }
  }

  if (body.defaultProvider) {
    config.defaultProvider = body.defaultProvider
    if (providerRegistry.has(body.defaultProvider)) {
      providerRegistry.setDefault(body.defaultProvider)
    }
  }

  await saveProviderConfig(config)
  return { ok: true }
})
