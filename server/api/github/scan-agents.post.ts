import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import { 
  parseGithubUrl, 
  getDefaultBranch, 
  fetchRepoTree, 
  detectAgents 
} from '../../utils/github'

export default defineEventHandler(async (event) => {
  const { url } = await readBody<{ url: string }>(event)

  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      data: { error: 'invalid_url', message: 'A GitHub URL is required' },
    })
  }

  const parsed = parseGithubUrl(url.trim())
  if (!parsed) {
    throw createError({
      statusCode: 400,
      data: { error: 'invalid_url', message: 'Could not parse GitHub URL. Expected format: https://github.com/owner/repo' },
    })
  }

  const branch = parsed.branch || await getDefaultBranch(parsed.owner, parsed.repo)
  
  // Fetch tree once
  const tree = await fetchRepoTree(parsed.owner, parsed.repo, branch)
  
  const { agents, totalCount } = await detectAgents(parsed.owner, parsed.repo, branch, parsed.path, tree)

  if (agents.length === 0) {
    throw createError({
      statusCode: 404,
      data: { error: 'no_agents', message: 'No valid agent files found at this location' },
    })
  }

  // Check for conflicts with existing local agents
  const agentsWithConflicts = agents.map(a => ({
    ...a,
    conflict: existsSync(resolveClaudePath('agents', a.slug + '.md')),
  }))

  return {
    owner: parsed.owner,
    repo: parsed.repo,
    branch,
    targetPath: parsed.path || '',
    agents: agentsWithConflicts,
    totalAgents: totalCount,
    detectionMethod: 'frontmatter',
  }
})
