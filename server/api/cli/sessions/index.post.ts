import { createCliSession } from '../../../utils/cliSession'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { agentSlug, workingDir, shell, cols, rows } = body

  try {
    const session = await createCliSession({
      agentSlug,
      workingDir,
      shell,
      cols,
      rows,
    })

    return session
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create CLI session',
    })
  }
})
