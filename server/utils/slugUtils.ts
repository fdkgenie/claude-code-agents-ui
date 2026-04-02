import { join } from 'node:path'

export interface SlugPath {
  directory: string
  filename: string
  slug: string
}

export function slugToPath(slug: string): { directory: string; filename: string } {
  const parts = slug.split('--')
  if (parts.length === 1) {
    return { directory: '', filename: `${parts[0]}.md` }
  }
  const filename = `${parts.pop()}.md`
  const directory = parts.join('/')
  return { directory, filename }
}

export function pathToSlug(directory: string, filename: string): string {
  const name = filename.replace(/\.md$/, '')
  if (!directory) return name
  return `${directory.replace(/\//g, '--')}--${name}`
}
