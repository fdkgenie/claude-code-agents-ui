import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../utils/claudeDir'
import { parseFrontmatter } from '../utils/frontmatter'

interface Suggestion {
  type: 'missing-skill' | 'missing-description' | 'empty-body' | 'orphan-skill'
  severity: 'warning' | 'info'
  message: string
  target: { type: 'agent' | 'command' | 'skill'; slug: string }
}

export default defineEventHandler(async () => {
  const suggestions: Suggestion[] = []

  // Load agents
  const agentsDir = resolveClaudePath('agents')
  const agents: { slug: string; name: string; body: string; description: string }[] = []
  if (existsSync(agentsDir)) {
    const files = await readdir(agentsDir)
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const slug = file.replace('.md', '')
      const raw = await readFile(resolveClaudePath('agents', file), 'utf-8')
      const { frontmatter, body } = parseFrontmatter<{ name?: string; description?: string }>(raw)
      agents.push({
        slug,
        name: frontmatter.name || slug,
        body,
        description: frontmatter.description || '',
      })
    }
  }

  // Load skills
  const skillsDir = resolveClaudePath('skills')
  const skills: { slug: string; agent?: string }[] = []
  if (existsSync(skillsDir)) {
    const dirs = await readdir(skillsDir, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const skillPath = resolveClaudePath('skills', d.name, 'SKILL.md')
      if (!existsSync(skillPath)) continue
      const raw = await readFile(skillPath, 'utf-8')
      const { frontmatter } = parseFrontmatter<{ agent?: string }>(raw)
      skills.push({ slug: d.name, agent: frontmatter.agent })
    }
  }

  // Load commands
  const commandsDir = resolveClaudePath('commands')
  const commands: { slug: string; description: string; body: string }[] = []
  if (existsSync(commandsDir)) {
    const files = await readdir(commandsDir)
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const slug = file.replace('.md', '')
      const raw = await readFile(resolveClaudePath('commands', file), 'utf-8')
      const { frontmatter, body } = parseFrontmatter<{ name?: string; description?: string }>(raw)
      commands.push({
        slug,
        description: frontmatter.description || '',
        body,
      })
    }
  }

  const agentNames = new Set(agents.map(a => a.name))
  const skillSlugs = new Set(skills.map(s => s.slug))

  // Check agents
  for (const agent of agents) {
    if (!agent.body.trim()) {
      suggestions.push({
        type: 'empty-body',
        severity: 'warning',
        message: `Agent "${agent.name}" has no instructions`,
        target: { type: 'agent', slug: agent.slug },
      })
    }
    if (!agent.description) {
      suggestions.push({
        type: 'missing-description',
        severity: 'warning',
        message: `Agent "${agent.name}" has no description`,
        target: { type: 'agent', slug: agent.slug },
      })
    }

    // Check if agent body references skill-like patterns but has no skills assigned
    const agentSkills = skills.filter(s => s.agent === agent.name)
    if (agentSkills.length === 0 && agent.body.length > 100) {
      // Check for references to skill-like concepts
      const skillPatterns = /skill|capability|can also|specialized in/i
      if (skillPatterns.test(agent.body)) {
        suggestions.push({
          type: 'missing-skill',
          severity: 'info',
          message: `Agent "${agent.name}" mentions capabilities but has no linked skills`,
          target: { type: 'agent', slug: agent.slug },
        })
      }
    }
  }

  // Check for orphan skills (not linked to any agent)
  for (const skill of skills) {
    if (!skill.agent) {
      suggestions.push({
        type: 'orphan-skill',
        severity: 'info',
        message: `Skill "${skill.slug}" is not linked to any agent`,
        target: { type: 'skill', slug: skill.slug },
      })
    } else if (!agentNames.has(skill.agent)) {
      suggestions.push({
        type: 'missing-skill',
        severity: 'warning',
        message: `Skill "${skill.slug}" references agent "${skill.agent}" which doesn't exist`,
        target: { type: 'skill', slug: skill.slug },
      })
    }
  }

  // Check commands
  for (const cmd of commands) {
    if (!cmd.body.trim()) {
      suggestions.push({
        type: 'empty-body',
        severity: 'warning',
        message: `Command "${cmd.slug}" has no instructions`,
        target: { type: 'command', slug: cmd.slug },
      })
    }
    if (!cmd.description) {
      suggestions.push({
        type: 'missing-description',
        severity: 'info',
        message: `Command "${cmd.slug}" has no description`,
        target: { type: 'command', slug: cmd.slug },
      })
    }
  }

  return suggestions
})
