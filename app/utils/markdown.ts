import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true,
})

/**
 * Render markdown to HTML (synchronous)
 * Note: This is a synchronous function for use in Vue templates
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  return marked.parse(text) as string
}
