<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPicker = ref(false)
const localValue = ref(props.modelValue)

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  localValue.value = newValue
})

// Debug: Watch showPicker changes
watch(() => showPicker.value, (newVal) => {
  console.log('[DirectoryPicker] showPicker changed:', newVal)
})

function handleFolderSelect() {
  // Show manual input dialog
  // Note: Browser File System Access API has security restrictions
  // For server-side directories, manual input is more reliable
  console.log('[DirectoryPicker] Opening modal, showPicker:', showPicker.value, '-> true')
  showPicker.value = true
}

function applyManualPath() {
  console.log('[DirectoryPicker] Applying path and closing modal')
  emit('update:modelValue', localValue.value)
  showPicker.value = false
}

// Close modal when navigating away from CLI page
const route = useRoute()
watch(() => route.path, (newPath) => {
  if (newPath !== '/cli') {
    showPicker.value = false
  }
})

// Also close on unmount (in case component is destroyed)
onBeforeUnmount(() => {
  showPicker.value = false
})
</script>

<template>
  <div>
    <!-- Directory display button -->
    <button
      class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono hover-bg"
      style="color: var(--text-secondary); background: var(--surface-raised);"
      @click="handleFolderSelect"
      title="Click to choose directory"
    >
      <UIcon name="i-lucide-folder" class="size-3" />
      {{ modelValue || 'Choose directory' }}
    </button>

    <!-- Manual input modal (fallback) -->
    <div
      v-if="showPicker"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showPicker = false"
    >
      <div class="w-[500px] p-6 rounded-xl shadow-xl" style="background: var(--surface);">
        <h3 class="text-[14px] font-semibold mb-2" style="color: var(--text-primary);">
          Choose Working Directory
        </h3>
        <p class="text-[11px] mb-3" style="color: var(--text-secondary);">
          Enter the full path to your working directory:
        </p>
        <input
          v-model="localValue"
          type="text"
          class="w-full px-3 py-2 rounded-lg text-[13px] font-mono"
          style="background: var(--surface-raised); color: var(--text-primary); border: 1px solid var(--border-subtle);"
          placeholder="/path/to/directory"
          @keyup.enter="applyManualPath"
        />
        <div class="flex gap-2 mt-4">
          <button
            class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium"
            style="background: var(--accent); color: white;"
            @click="applyManualPath"
          >
            Apply
          </button>
          <button
            class="px-3 py-2 rounded-lg text-[12px] font-medium"
            style="background: var(--surface-raised); color: var(--text-secondary);"
            @click="showPicker = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
