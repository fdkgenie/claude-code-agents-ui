import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveClaudePath } from '../../utils/claudeDir'
import { parseFrontmatter } from '../../utils/frontmatter'
import type { PluginDetail, SkillFrontmatter } from '~/types'

interface InstalledEntry {
  scope: string
  installPath: string
  version: string
  installedAt: string
  lastUpdated: string
}

interface PluginJson {
  name: string
  description?: string
  version?: string
  author?: { name: string; email?: string }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    if (!existsSync(path)) return null
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const id = decodeURIComponent(getRouterParam(event, 'id')!)
  const installedPath = resolveClaudePath('plugins', 'installed_plugins.json')
  const settingsPath = resolveClaudePath('settings.json')

  const installed = await readJson<{ plugins: Record<string, InstalledEntry[]> }>(installedPath)
  const entries = installed?.plugins?.[id]
  if (!entries?.length) {
    throw createError({ statusCode: 404, message: `Plugin not found: ${id}` })
  }

  const entry = entries[0]
  const [name, marketplace] = id.split('@')
  const pluginJsonPath = join(entry.installPath, '.claude-plugin', 'plugin.json')
  const meta = await readJson<PluginJson>(pluginJsonPath)

  const settings = await readJson<{ enabledPlugins?: Record<string, boolean> }>(settingsPath)

  // Load skills
  const skillDetails = []
  const skillsDir = join(entry.installPath, 'skills')
  if (existsSync(skillsDir)) {
    const skillDirs = await readdir(skillsDir, { withFileTypes: true })
    for (const dir of skillDirs) {
      if (!dir.isDirectory()) continue
      const skillPath = join(skillsDir, dir.name, 'SKILL.md')
      if (!existsSync(skillPath)) continue
      const raw = await readFile(skillPath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(raw)
      skillDetails.push({
        slug: dir.name,
        frontmatter: { name: dir.name, ...frontmatter },
        body,
        filePath: skillPath,
      })
    }
  }

  return {
    id,
    name: meta?.name ?? name,
    marketplace: marketplace ?? 'unknown',
    description: meta?.description ?? '',
    version: entry.version,
    enabled: settings?.enabledPlugins?.[id] ?? false,
    installedAt: entry.installedAt,
    lastUpdated: entry.lastUpdated,
    installPath: entry.installPath,
    skills: skillDetails.map(s => s.slug),
    author: meta?.author,
    skillDetails: skillDetails.sort((a, b) => a.slug.localeCompare(b.slug)),
  } satisfies PluginDetail
})
