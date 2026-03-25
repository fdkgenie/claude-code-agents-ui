import { listChatSessions } from '../../../utils/chatSessionStorage'

export default defineEventHandler(async () => {
  try {
    const sessions = await listChatSessions()
    return sessions
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to list chat sessions',
    })
  }
})
