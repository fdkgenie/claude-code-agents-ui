export interface FileEditorState {
  isOpen: boolean
  filePath: string | null
  content: string | null
  diffInfo: {
    oldContent: string
    newContent: string
  } | null
}

export function useFileEditor() {
  const state = useState<FileEditorState>('file-editor-state', () => ({
    isOpen: false,
    filePath: null,
    content: null,
    diffInfo: null,
  }))

  function openFile(filePath: string, diffInfo?: { oldContent: string; newContent: string }) {
    state.value.filePath = filePath
    state.value.diffInfo = diffInfo || null
    state.value.isOpen = true
  }

  function closeEditor() {
    state.value.isOpen = false
    state.value.filePath = null
    state.value.content = null
    state.value.diffInfo = null
  }

  return {
    state: readonly(state),
    openFile,
    closeEditor,
  }
}
