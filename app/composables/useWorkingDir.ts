export function useWorkingDir() {
  const workingDir = useState<string>('working-dir', () => '')

  // Hydrate from localStorage on client
  if (import.meta.client && !workingDir.value) {
    const stored = localStorage.getItem('agents-ui:working-dir')
    if (stored) workingDir.value = stored
  }

  function setWorkingDir(dir: string) {
    const trimmed = dir.trim()
    workingDir.value = trimmed
    if (import.meta.client) {
      if (trimmed) {
        localStorage.setItem('agents-ui:working-dir', trimmed)
      } else {
        localStorage.removeItem('agents-ui:working-dir')
      }
    }
  }

  function clearWorkingDir() {
    setWorkingDir('')
  }

  const displayPath = computed(() => {
    if (!workingDir.value) return null
    // Show last 2 segments for brevity
    const parts = workingDir.value.split('/')
    return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : workingDir.value
  })

  return {
    workingDir: readonly(workingDir),
    displayPath,
    setWorkingDir,
    clearWorkingDir,
  }
}
