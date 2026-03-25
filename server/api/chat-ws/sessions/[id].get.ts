import { getChatSession, loadSessionMessages } from '../../../utils/chatSessionStorage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  try {
    const query = getQuery(event)
    const limit = query.limit ? parseInt(query.limit as string) : 50
    const offset = query.offset ? parseInt(query.offset as string) : 0

    // Get session metadata
    // Note: getChatSession now returns an empty session object if the file doesn't exist
    // This is intentional - sessions are created lazily when first message is saved
    const session = await getChatSession(id)

    if (!session) {
      // This should never happen now, but handle it gracefully just in case
      console.warn(`[GET session] Unexpectedly got null session for ${id}`)
      const now = new Date().toISOString()
      return {
        id,
        messages: [],
        createdAt: now,
        lastActivity: now,
        status: 'active',
        messageCount: 0,
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
      }
    }

    // Load messages with pagination
    const { messages, total, hasMore } = await loadSessionMessages(id, {
      limit,
      offset,
    })

    return {
      ...session,
      messages,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    }
  } catch (error: any) {
    console.error(`Error loading session ${id}:`, error)

    // Return empty session on error (graceful degradation - no 404/500)
    const now = new Date().toISOString()
    return {
      id,
      messages: [],
      createdAt: now,
      lastActivity: now,
      status: 'active',
      messageCount: 0,
      pagination: {
        total: 0,
        limit: parseInt(getQuery(event).limit as string) || 50,
        offset: parseInt(getQuery(event).offset as string) || 0,
        hasMore: false,
      },
    }
  }
})
