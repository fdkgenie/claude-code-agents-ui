<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  disabled?: boolean
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'send': []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

function handleKeydown(event: KeyboardEvent) {
  // Enter to send (Shift+Enter for newline)
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (!props.disabled && localValue.value.trim()) {
      emit('send')
    }
  }
}

function handleSend() {
  if (!props.disabled && localValue.value.trim()) {
    emit('send')
  }
}

// Auto-resize textarea
watch(localValue, () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = `${textareaRef.value.scrollHeight}px`
  }
})

// Focus on mount
onMounted(() => {
  textareaRef.value?.focus()
})
</script>

<template>
  <div class="p-4" style="background: var(--surface-base);">
    <div class="flex items-end gap-2">
      <!-- Textarea -->
      <div class="flex-1 relative">
        <textarea
          ref="textareaRef"
          v-model="localValue"
          :disabled="disabled"
          placeholder="Type your message here... (Shift+Enter for new line)"
          class="w-full px-4 py-3 rounded-lg text-[14px] resize-none focus:outline-none transition-all"
          :style="{
            background: 'var(--surface-raised)',
            color: 'var(--text-primary)',
            border: disabled ? '1px solid var(--border-subtle)' : '2px solid var(--border-subtle)',
            maxHeight: '200px',
            minHeight: '50px',
            boxShadow: disabled ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)',
          }"
          rows="1"
          @keydown="handleKeydown"
        />
      </div>

      <!-- Send button -->
      <button
        :disabled="disabled || !localValue.trim()"
        class="px-4 py-3 rounded-lg text-[14px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        :style="{
          background: disabled || !localValue.trim() ? 'var(--surface-raised)' : 'var(--accent)',
          color: disabled || !localValue.trim() ? 'var(--text-disabled)' : 'white',
        }"
        @click="handleSend"
      >
        <UIcon v-if="isStreaming" name="i-lucide-square" class="size-4" />
        <UIcon v-else name="i-lucide-send" class="size-4" />
      </button>
    </div>

    <!-- Helper text -->
    <div class="mt-2 flex items-center justify-between text-[11px]" style="color: var(--text-tertiary);">
      <span>Press Enter to send, Shift+Enter for new line</span>
      <span v-if="localValue">{{ localValue.length }} characters</span>
    </div>
  </div>
</template>
