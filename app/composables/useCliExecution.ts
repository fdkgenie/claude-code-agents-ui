import type { Agent, CliSession } from '~/types'

export function useCliExecution() {
  const selectedAgent = ref<Agent | null>(null)
  const workingDirectory = ref<string>('')
  const mode = ref<'agent' | 'standalone'>('standalone')
  const sessions = ref<{ active: CliSession[]; history: CliSession[] }>({ active: [], history: [] })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Set agent for agent-aware mode
   */
  function setAgent(agent: Agent | null) {
    selectedAgent.value = agent
    if (agent) {
      mode.value = 'agent'
    }
  }

  /**
   * Set working directory
   */
  function setWorkingDirectory(dir: string) {
    workingDirectory.value = dir
  }

  /**
   * Toggle between agent-aware and standalone mode
   */
  function toggleMode() {
    if (mode.value === 'agent') {
      mode.value = 'standalone'
      selectedAgent.value = null
    } else {
      mode.value = 'agent'
    }
  }

  /**
   * Fetch all sessions (active + history)
   */
  async function fetchSessions() {
    try {
      isLoading.value = true
      error.value = null
      const response = await $fetch('/api/cli/sessions')
      sessions.value = response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch sessions'
      console.error('Error fetching sessions:', e)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch a specific session by ID
   */
  async function fetchSession(id: string) {
    try {
      isLoading.value = true
      error.value = null
      const response = await $fetch(`/api/cli/sessions/${id}`)
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch session'
      console.error('Error fetching session:', e)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Terminate a session
   */
  async function terminateSession(id: string) {
    try {
      isLoading.value = true
      error.value = null
      await $fetch(`/api/cli/sessions/${id}`, {
        method: 'DELETE',
      })
      // Refresh sessions list
      await fetchSessions()
    } catch (e: any) {
      error.value = e.message || 'Failed to terminate session'
      console.error('Error terminating session:', e)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get execution options for terminal connection
   */
  const executionOptions = computed(() => {
    return {
      agentSlug: mode.value === 'agent' ? selectedAgent.value?.slug : undefined,
      workingDir: workingDirectory.value || undefined,
    }
  })

  /**
   * Check if can execute (has required settings)
   */
  const canExecute = computed(() => {
    if (mode.value === 'agent') {
      return !!selectedAgent.value
    }
    return true // Standalone mode can always execute
  })

  /**
   * Get status badge info
   */
  const statusInfo = computed(() => {
    if (mode.value === 'agent' && selectedAgent.value) {
      return {
        mode: 'agent',
        label: selectedAgent.value.frontmatter.name,
        color: selectedAgent.value.frontmatter.color || '#3b82f6',
      }
    }
    return {
      mode: 'standalone',
      label: 'Standalone',
      color: '#6b7280',
    }
  })

  // Auto-fetch sessions on mount
  onMounted(() => {
    fetchSessions()
  })

  return {
    selectedAgent,
    workingDirectory,
    mode,
    sessions,
    isLoading,
    error,
    executionOptions,
    canExecute,
    statusInfo,
    setAgent,
    setWorkingDirectory,
    toggleMode,
    fetchSessions,
    fetchSession,
    terminateSession,
  }
}
