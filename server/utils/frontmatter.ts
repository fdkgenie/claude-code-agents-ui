import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export function parseFrontmatter<T>(raw: string): { frontmatter: T; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {} as T, body: raw }
  }
  const yamlBlock = match[1]!
  const bodyBlock = match[2]!
  try {
    const frontmatter = parseYaml(yamlBlock) as T
    const body = bodyBlock.replace(/^\n/, '')
    return { frontmatter, body }
  } catch {
    // Fallback: try to parse key-value pairs manually for malformed YAML
    const lines = yamlBlock.split('\n')
    const fm: Record<string, unknown> = {}
    for (const line of lines) {
      const kvMatch = line.match(/^(\S+):\s*(.*)$/)
      if (kvMatch) {
        const key = kvMatch[1]!
        let value: unknown = kvMatch[2]!.trim()
        // Strip surrounding quotes
        if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1)
        }
        fm[key] = value
      }
    }
    const body = bodyBlock.replace(/^\n/, '')
    return { frontmatter: fm as T, body }
  }
}

export function serializeFrontmatter(frontmatter: object, body: string): string {
  const yamlStr = stringifyYaml(frontmatter as Record<string, unknown>, { lineWidth: 0 }).trimEnd()
  return `---\n${yamlStr}\n---\n\n${body}`
}
