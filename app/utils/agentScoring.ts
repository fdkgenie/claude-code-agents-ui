export interface QualityIssue {
  type: 'error' | 'warning' | 'tip'
  message: string
}

export interface QualityScore {
  score: number // 0-100
  label: string
  color: string
  issues: QualityIssue[]
}

export function scoreAgent(frontmatter: { name: string; description: string; model?: string; memory?: string }, body: string): QualityScore {
  const issues: QualityIssue[] = []
  let score = 100

  // Name checks
  if (!frontmatter.name.trim()) {
    issues.push({ type: 'error', message: 'Agent has no name' })
    score -= 20
  }

  // Description checks
  if (!frontmatter.description.trim()) {
    issues.push({ type: 'error', message: 'Missing description — Claude won\'t know when to use this agent' })
    score -= 15
  } else if (frontmatter.description.length < 20) {
    issues.push({ type: 'warning', message: 'Description is very short — add more detail about when to use this agent' })
    score -= 5
  }

  // Model check
  if (!frontmatter.model) {
    issues.push({ type: 'tip', message: 'No model specified — will use the default. Consider setting one for predictable behavior.' })
    score -= 3
  }

  // Body/instructions checks
  if (!body.trim()) {
    issues.push({ type: 'error', message: 'No instructions — this agent has no custom behavior' })
    score -= 30
  } else {
    const lines = body.split('\n').filter(l => l.trim())
    const words = body.split(/\s+/).length

    if (words < 20) {
      issues.push({ type: 'warning', message: 'Instructions are very brief. More detail helps Claude understand exactly what you want.' })
      score -= 10
    }

    // Check for structure (headers, lists, numbered steps)
    const hasStructure = /^#+\s|^\d+\.\s|^[-*]\s/m.test(body)
    if (words > 50 && !hasStructure) {
      issues.push({ type: 'tip', message: 'Consider adding structure (headers, numbered steps, or bullet points) to make instructions clearer' })
      score -= 5
    }

    // Check for role definition
    const hasRole = /you are|your role|act as|behave as/i.test(body)
    if (!hasRole) {
      issues.push({ type: 'tip', message: 'Consider starting with "You are..." to define the agent\'s role clearly' })
      score -= 3
    }

    // Check for constraints/rules
    const hasConstraints = /don't|do not|never|always|must|rules|guidelines|avoid/i.test(body)
    if (words > 30 && !hasConstraints) {
      issues.push({ type: 'tip', message: 'Adding explicit rules (do/don\'t) helps prevent unwanted behavior' })
      score -= 3
    }

    // Check for output format guidance
    const hasFormat = /format|output|respond with|return|structure/i.test(body)
    if (words > 50 && !hasFormat) {
      issues.push({ type: 'tip', message: 'Consider specifying the expected output format' })
      score -= 2
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  // Determine label and color
  let label: string
  let color: string
  if (score >= 80) {
    label = 'Good'
    color = 'var(--success, #22c55e)'
  } else if (score >= 60) {
    label = 'Okay'
    color = 'var(--warning, #eab308)'
  } else if (score >= 40) {
    label = 'Needs work'
    color = 'var(--warning, #eab308)'
  } else {
    label = 'Incomplete'
    color = 'var(--error, #ef4444)'
  }

  return { score, label, color, issues }
}
