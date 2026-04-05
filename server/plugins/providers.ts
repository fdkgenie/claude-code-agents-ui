// server/plugins/providers.ts
import { providerRegistry } from '../utils/providers/registry'
import { getProviderConfig } from '../utils/providers/providerConfig'
import { CustomAnthropicProvider, customProviderInfo } from '../utils/providers/customProvider'

export default defineNitroPlugin(async () => {
  try {
    const config = await getProviderConfig()
    const customEntry = config.providers.find(p => p.name === 'custom' && !p.builtIn)

    if (customEntry?.baseUrl && customEntry?.authToken) {
      providerRegistry.register(new CustomAnthropicProvider(customEntry), customProviderInfo(customEntry))
      console.log('[providers] Registered custom provider:', customEntry.displayName)
    }

    if (providerRegistry.has(config.defaultProvider)) {
      providerRegistry.setDefault(config.defaultProvider)
    }
  }
  catch (err) {
    console.error('[providers] Failed to load providers.json:', err)
  }
})
