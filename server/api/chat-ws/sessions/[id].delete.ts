import { deleteChatSession } from '../../../utils/chatSessionStorage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  try {
    const deleted = await deleteChatSession(id)

    if (!deleted) {
      throw createError({
        statusCode: 404,
        message: `Session ${id} not found`,
      })
    }

    return {
      success: true,
      message: `Session ${id} deleted`,
    }
  } catch (error: any) {
    if (error.statusCode) throw error

    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to delete session',
    })
  }
})
