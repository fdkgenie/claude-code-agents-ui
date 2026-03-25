import { getAllSessions, listSessionHistories } from '../../../utils/cliSession'

export default defineEventHandler(async () => {
  // Get active sessions
  const activeSessions = getAllSessions()

  // Get session histories
  const histories = await listSessionHistories()

  return {
    active: activeSessions,
    history: histories,
  }
})
