import { providerRegistry } from '../../../utils/providers/registry'
import { getProviderConfig } from '../../../utils/providers/providerConfig'

export default defineEventHandler(async () => {
  const config = await getProviderConfig()
  const providers = providerRegistry.getAllInfo()

  return {
    providers,
    default: config.defaultProvider,
  }
})
