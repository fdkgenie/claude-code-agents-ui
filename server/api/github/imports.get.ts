import { readImportsRegistry } from '../../utils/github'

export default defineEventHandler(async (event) => {
  const { type } = getQuery(event) as { type: 'skills' | 'agents' }
  
  if (!type || (type !== 'skills' && type !== 'agents')) {
    throw createError({ statusCode: 400, message: 'Registry type (skills or agents) is required' })
  }

  return await readImportsRegistry(type)
})
