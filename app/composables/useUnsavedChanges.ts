export function useUnsavedChanges(isDirty: Ref<boolean> | ComputedRef<boolean>) {
  if (!import.meta.client) return

  // Guard against browser close/reload
  const handler = (e: BeforeUnloadEvent) => {
    if (isDirty.value) {
      e.preventDefault()
    }
  }

  onMounted(() => window.addEventListener('beforeunload', handler))
  onUnmounted(() => window.removeEventListener('beforeunload', handler))

  // Guard against in-app navigation
  onBeforeRouteLeave(() => {
    if (isDirty.value) {
      return window.confirm('You have unsaved changes. Leave without saving?')
    }
  })
}
