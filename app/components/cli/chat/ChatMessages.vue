<script setup lang="ts">
import type { NormalizedMessage } from '~/types'

const props = defineProps<{
  messages: NormalizedMessage[]
  streamingText: string
  isStreaming: boolean
}>()
</script>

<template>
  <div class="space-y-4">
    <!-- Regular messages -->
    <MessageItem
      v-for="message in messages"
      :key="message.id"
      :message="message"
    />

    <!-- Streaming message -->
    <div v-if="isStreaming && streamingText" class="w-full">
      <div class="flex items-start gap-3 mb-2">
        <div class="size-8 rounded-full flex items-center justify-center shrink-0" style="background: var(--accent-muted);">
          <UIcon name="i-lucide-bot" class="size-4" style="color: var(--accent);" />
        </div>
        <span class="text-[13px] font-medium" style="color: var(--text-primary);">Claude</span>
      </div>
      <div class="ml-11 text-[14px] leading-relaxed" style="color: var(--text-primary);">
        {{ streamingText }}<span class="inline-block w-1 h-4 ml-1 animate-pulse" style="background: var(--accent);" />
      </div>
    </div>

    <!-- Thinking indicator (when no text yet) -->
    <div v-else-if="isStreaming && !streamingText" class="flex items-center gap-2 ml-11">
      <div class="flex gap-1">
        <div class="size-2 rounded-full animate-bounce" style="background: var(--text-disabled); animation-delay: 0ms;" />
        <div class="size-2 rounded-full animate-bounce" style="background: var(--text-disabled); animation-delay: 150ms;" />
        <div class="size-2 rounded-full animate-bounce" style="background: var(--text-disabled); animation-delay: 300ms;" />
      </div>
      <span class="text-[12px]" style="color: var(--text-secondary);">Thinking...</span>
    </div>
  </div>
</template>
