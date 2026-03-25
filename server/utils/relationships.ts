import type { Relationship } from '~/types'

interface PluginEntry {
  id: string
  name: string
  skills: string[]
}

export function extractRelationships(
  agents: { slug: string; body: string }[],
  commands: { slug: string; body: string; frontmatter: Record<string, unknown> }[],
  skills: { slug: string; body: string; frontmatter: Record<string, unknown> }[] = [],
  plugins: PluginEntry[] = [],
): Relationship[] {
  const relationships: Relationship[] = []
  const agentNames = new Set(agents.map(a => a.slug))
  const skillSlugs = new Set(skills.map(s => s.slug))
  const seen = new Set<string>()

  function add(rel: Relationship) {
    const key = `${rel.sourceType}:${rel.sourceSlug}->${rel.targetType}:${rel.targetSlug}`
    if (!seen.has(key)) {
      seen.add(key)
      relationships.push(rel)
    }
  }

  for (const cmd of commands) {
    // Check frontmatter agent reference
    const agentRef = cmd.frontmatter.agent as string | undefined
    if (agentRef && agentNames.has(agentRef)) {
      add({
        sourceType: 'command',
        sourceSlug: cmd.slug,
        targetType: 'agent',
        targetSlug: agentRef,
        type: 'agent-frontmatter',
        evidence: `agent: ${agentRef}`,
      })
    }

    // Scan body for subagent_type patterns
    const subagentMatches = cmd.body.matchAll(/subagent_type\s*[:=]\s*["']?([a-z][\w-]*)["']?/gi)
    for (const m of subagentMatches) {
      const name = m[1]
      if (agentNames.has(name)) {
        add({
          sourceType: 'command',
          sourceSlug: cmd.slug,
          targetType: 'agent',
          targetSlug: name,
          type: 'spawns',
          evidence: m[0],
        })
      }
    }

    // Scan body for "spawn <agent>" patterns
    const spawnMatches = cmd.body.matchAll(/[Ss]pawn(?:s|ed)?\s+(?:the\s+)?["']?([a-z][\w-]*)["']?/g)
    for (const m of spawnMatches) {
      const name = m[1]
      if (agentNames.has(name)) {
        add({
          sourceType: 'command',
          sourceSlug: cmd.slug,
          targetType: 'agent',
          targetSlug: name,
          type: 'spawns',
          evidence: m[0],
        })
      }
    }

    // Scan for direct agent name mentions (only known agents)
    for (const agentSlug of agentNames) {
      if (agentSlug.length < 4) continue // skip very short names to avoid false positives
      const regex = new RegExp(`\\b${agentSlug.replace(/-/g, '[\\s-]')}\\b`, 'gi')
      if (regex.test(cmd.body)) {
        add({
          sourceType: 'command',
          sourceSlug: cmd.slug,
          targetType: 'agent',
          targetSlug: agentSlug,
          type: 'spawns',
          evidence: `mentions "${agentSlug}"`,
        })
      }
    }
  }

  // Scan agent bodies for command references
  for (const agent of agents) {
    const cmdMatches = agent.body.matchAll(/\/(\w+[:\-]\w[\w-]*)/g)
    for (const m of cmdMatches) {
      const cmdName = m[1]
      const matchingCmd = commands.find(c =>
        c.frontmatter.name === cmdName || c.slug === cmdName.replace(/:/g, '--')
      )
      if (matchingCmd) {
        add({
          sourceType: 'agent',
          sourceSlug: agent.slug,
          targetType: 'command',
          targetSlug: matchingCmd.slug,
          type: 'spawned-by',
          evidence: m[0],
        })
      }
    }
  }

  // Skills: check frontmatter.agent reference to link skill -> agent
  for (const skill of skills) {
    const agentRef = skill.frontmatter.agent as string | undefined
    if (agentRef && agentNames.has(agentRef)) {
      add({
        sourceType: 'skill',
        sourceSlug: skill.slug,
        targetType: 'agent',
        targetSlug: agentRef,
        type: 'agent-frontmatter',
        evidence: `agent: ${agentRef}`,
      })
    }

    // Scan skill body for agent references
    for (const agentSlug of agentNames) {
      if (agentSlug.length < 4) continue
      const regex = new RegExp(`\\b${agentSlug.replace(/-/g, '[\\s-]')}\\b`, 'gi')
      if (regex.test(skill.body)) {
        add({
          sourceType: 'skill',
          sourceSlug: skill.slug,
          targetType: 'agent',
          targetSlug: agentSlug,
          type: 'spawns',
          evidence: `mentions "${agentSlug}"`,
        })
      }
    }
  }

  // Plugins: link plugin -> its skills
  for (const plugin of plugins) {
    for (const skillName of plugin.skills) {
      if (skillSlugs.has(skillName)) {
        add({
          sourceType: 'plugin',
          sourceSlug: plugin.id,
          targetType: 'skill',
          targetSlug: skillName,
          type: 'spawns',
          evidence: `provides skill "${skillName}"`,
        })
      }
    }
  }

  return relationships
}
