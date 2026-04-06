// server/utils/providers/providerConfig.ts
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../claudeDir'

export interface ProviderEntry {
  name: string
  displayName: string
  builtIn?: boolean
  baseUrl?: string
  authToken?: string
  modelMappings?: Partial<Record<'opus' | 'sonnet' | 'haiku', string>>
}

export interface ProviderConfig {
  defaultProvider: string
  providers: ProviderEntry[]
}

const DEFAULT_CONFIG: ProviderConfig = {
  defaultProvider: 'claude',
  providers: [{ name: 'claude', displayName: 'Claude (Default)', builtIn: true }],
}

export async function getProviderConfig(): Promise<ProviderConfig> {
  const filePath = resolveClaudePath('providers.json')
  if (!existsSync(filePath)) return structuredClone(DEFAULT_CONFIG)
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as ProviderConfig
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  const filePath = resolveClaudePath('providers.json')
  await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}
