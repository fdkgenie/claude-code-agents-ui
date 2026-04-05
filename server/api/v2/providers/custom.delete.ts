// server/api/v2/providers/custom.delete.ts
import { providerRegistry } from '../../../utils/providers/registry'
import { getProviderConfig, saveProviderConfig } from '../../../utils/providers/providerConfig'

export default defineEventHandler(async () => {
  const config = await getProviderConfig()

  config.providers = config.providers.filter(p => p.name !== 'custom')
  config.defaultProvider = 'claude'

  await saveProviderConfig(config)

  providerRegistry.deregister('custom')
  providerRegistry.setDefault('claude')

  return { ok: true }
})
