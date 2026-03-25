import { listProjects } from '../../utils/claudeProjects'

export default defineEventHandler(async () => {
  const projects = await listProjects()
  return projects
})
