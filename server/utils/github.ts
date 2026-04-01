import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveClaudePath } from './claudeDir'
import { parseFrontmatter } from './frontmatter'
import type { SkillFrontmatter, GithubImport, GithubImportsRegistry } from '~/types'

interface ParsedGithubUrl {
  owner: string
  repo: string
  branch: string | null
  path: string | null
}

const SKIP_FILENAMES = new Set([
  'README.md', 'readme.md',
  'CHANGELOG.md', 'changelog.md',
  'CONTRIBUTING.md', 'contributing.md',
  'LICENSE.md', 'license.md',
  'CODE_OF_CONDUCT.md',
])

export function parseGithubUrl(url: string): ParsedGithubUrl | null {
  const match = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(tree|blob)\/([^/]+)(?:\/(.+))?)?$/
  )
  if (!match) return null

  return {
    owner: match[1]!,
    repo: match[2]!,
    branch: match[4] || null,
    path: match[5] || null,
  }
}

interface GithubTreeEntry {
  path: string
  type: 'blob' | 'tree'
  sha: string
  url: string
}

interface SkillsIndexEntry {
  slug: string
  name: string
  description: string
  category?: string
  tags?: string | string[]
  path: string
  files: string[]
  metadata?: Record<string, unknown>
}

interface SkillsIndex {
  version: string
  skills: SkillsIndexEntry[]
}

export async function fetchRepoTree(owner: string, repo: string, branch: string): Promise<GithubTreeEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'agents-ui',
    },
  })

  if (response.status === 403) {
    const resetHeader = response.headers.get('x-ratelimit-reset')
    const resetIn = resetHeader ? Math.ceil((parseInt(resetHeader) * 1000 - Date.now()) / 60000) : '?'
    throw createError({
      statusCode: 429,
      data: { error: 'rate_limited', message: `GitHub API rate limit reached. Try again in ${resetIn} minutes.` },
    })
  }

  if (response.status === 404) {
    throw createError({
      statusCode: 404,
      data: { error: 'not_found', message: 'Repository or branch not found' },
    })
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      data: { error: 'github_error', message: `GitHub API error: ${response.statusText}` },
    })
  }

  const data = await response.json() as { tree: GithubTreeEntry[] }
  return data.tree
}

export async function fetchFileContent(owner: string, repo: string, branch: string, path: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'agents-ui',
    },
  })

  if (response.status === 403) {
    const resetHeader = response.headers.get('x-ratelimit-reset')
    const resetIn = resetHeader ? Math.ceil((parseInt(resetHeader) * 1000 - Date.now()) / 60000) : '?'
    throw createError({
      statusCode: 429,
      data: { error: 'rate_limited', message: `GitHub API rate limit reached. Try again in ${resetIn} minutes.` },
    })
  }

  if (!response.ok) {
    throw createError({ statusCode: response.status, message: `Failed to fetch ${path}` })
  }

  const data = await response.json() as { content: string; encoding: string }
  if (data.encoding === 'base64') {
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }
  return data.content
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}`
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'agents-ui',
    },
  })

  if (response.status === 403) {
    const resetHeader = response.headers.get('x-ratelimit-reset')
    const resetIn = resetHeader ? Math.ceil((parseInt(resetHeader) * 1000 - Date.now()) / 60000) : '?'
    throw createError({
      statusCode: 429,
      data: { error: 'rate_limited', message: `GitHub API rate limit reached. Try again in ${resetIn} minutes.` },
    })
  }

  if (!response.ok) {
    throw createError({
      statusCode: 404,
      data: { error: 'not_found', message: 'Repository not found' },
    })
  }

  const data = await response.json() as { default_branch: string }
  return data.default_branch
}

interface DetectedSkill {
  slug: string
  name: string
  description: string
  category: string | null
  tags: string[]
  filePath: string
  hasSupporting: boolean
}

interface DetectedAgent {
  slug: string
  name: string
  description: string
  filePath: string
}

export async function detectSkills(
  owner: string,
  repo: string,
  branch: string,
  targetPath: string | null,
  tree: GithubTreeEntry[]
): Promise<{ skills: DetectedSkill[]; totalCount: number; detectionMethod: 'frontmatter' | 'skills-index' }> {
  let skills: DetectedSkill[] = []
  let totalCount = 0
  let detectionMethod: 'frontmatter' | 'skills-index' = 'frontmatter'

  // 1. Check for skills-index.json at repo root for skills
  const indexEntry = tree.find(e => e.path === 'skills-index.json')
  if (indexEntry) {
    const content = await fetchFileContent(owner, repo, branch, 'skills-index.json')
    try {
      const index = JSON.parse(content) as SkillsIndex
      skills = index.skills.map(s => ({
        slug: s.slug,
        name: s.name || s.slug,
        description: typeof s.description === 'string' ? s.description.replace(/^>\s*/, '') : '',
        category: s.category || null,
        tags: Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? [s.tags] : []),
        filePath: s.files?.[0] || s.path,
        hasSupporting: (s.files?.length || 0) > 1,
      }))

      // Filter to target path if specified
      if (targetPath) {
        skills = skills.filter(s => s.filePath.startsWith(targetPath))
      }
      detectionMethod = 'skills-index'
      return { skills, totalCount: skills.length, detectionMethod }
    } catch {
      // Fallback to frontmatter if index is invalid
    }
  }

  // 2. Scan for SKILL.md files
  const prefix = targetPath ? targetPath + '/' : ''
  const skillFiles = tree.filter(e =>
    e.type === 'blob'
    && e.path.toLowerCase().endsWith('skill.md')
    && (prefix ? e.path.startsWith(prefix) : true)
  )

  totalCount = skillFiles.length

  // Only scan first 50 to avoid rate limits
  for (const file of skillFiles.slice(0, 50)) {
    try {
      const content = await fetchFileContent(owner, repo, branch, file.path)
      const { frontmatter } = parseFrontmatter<any>(content)

      if (frontmatter.name && frontmatter.description) {
        const parts = file.path.split('/')
        const parentDir = parts.at(-2)
        const slug = parentDir || frontmatter.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

        const dir = parts.slice(0, -1).join('/')
        const hasSupporting = tree.some(e =>
          e.type === 'blob'
          && e.path.startsWith(dir + '/')
          && e.path !== file.path
        )

        const category = parts.length > 2 ? parts[parts.length - 3] || null : null

        skills.push({
          slug,
          name: frontmatter.name,
          description: frontmatter.description,
          category,
          tags: [],
          filePath: file.path,
          hasSupporting,
        })
      }
    } catch (e: any) {
      if (e.statusCode === 429) throw e // Propagate rate limit
    }
  }

  return { skills, totalCount, detectionMethod: 'frontmatter' }
}

export async function detectAgents(
  owner: string,
  repo: string,
  branch: string,
  targetPath: string | null,
  tree: GithubTreeEntry[]
): Promise<{ agents: DetectedAgent[]; totalCount: number }> {
  const agents: DetectedAgent[] = []
  const prefix = targetPath ? targetPath + '/' : ''
  
  // Scan for .md files (excluding SKILL.md and common docs)
  const mdFiles = tree.filter(e =>
    e.type === 'blob'
    && e.path.endsWith('.md')
    && !e.path.toLowerCase().endsWith('skill.md')
    && (prefix ? e.path.startsWith(prefix) : true)
    && !SKIP_FILENAMES.has(e.path.split('/').pop()!)
  )

  // Every markdown file that is not a SKILL.md or README is a potential agent
  const totalCount = mdFiles.length

  // Prioritize agents/ folder
  const prioritized = mdFiles.sort((a, b) => {
    const aIsAgent = a.path.includes('agents/') || a.path.toLowerCase().includes('agent')
    const bIsAgent = b.path.includes('agents/') || b.path.toLowerCase().includes('agent')
    if (aIsAgent && !bIsAgent) return -1
    if (!aIsAgent && bIsAgent) return 1
    return 0
  })

  // Only scan first 50 to avoid rate limits
  for (const file of prioritized.slice(0, 50)) {
    try {
      const content = await fetchFileContent(owner, repo, branch, file.path)
      const { frontmatter } = parseFrontmatter<any>(content)

      if (frontmatter.name && frontmatter.description) {
        const parts = file.path.split('/')
        const fileName = parts.pop()!
        let slug = fileName.replace(/\.md$/, '')
        
        if (slug.toLowerCase() === 'agent' && parts.length > 0) {
          slug = parts[parts.length - 1]!
        }

        agents.push({
          slug,
          name: frontmatter.name,
          description: frontmatter.description,
          filePath: file.path,
        })
      }
    } catch (e: any) {
      if (e.statusCode === 429) throw e // Propagate rate limit
    }
  }

  return { agents, totalCount }
}

// ── Registry helpers ──────────────────────────────────

export function getRegistryPath(type: 'skills' | 'agents'): string {
  return resolveClaudePath('github', `${type}-imports.json`)
}

export async function readImportsRegistry(type: 'skills' | 'agents'): Promise<GithubImportsRegistry> {
  const path = getRegistryPath(type)
  if (!existsSync(path)) return { imports: [] }
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as GithubImportsRegistry
  } catch {
    return { imports: [] }
  }
}

export async function writeImportsRegistry(type: 'skills' | 'agents', registry: GithubImportsRegistry): Promise<void> {
  const path = getRegistryPath(type)
  const dir = dirname(path)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  await writeFile(path, JSON.stringify(registry, null, 2), 'utf-8')
}

export function findImport(registry: GithubImportsRegistry, owner: string, repo: string): GithubImport | undefined {
  return registry.imports.find(i => i.owner === owner && i.repo === repo)
}
