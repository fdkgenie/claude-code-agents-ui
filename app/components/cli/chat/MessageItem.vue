<script setup lang="ts">
import type { NormalizedMessage } from '~/types'
import { renderMarkdown } from '~/utils/markdown'

const props = defineProps<{
  message: NormalizedMessage
}>()

const isExpanded = ref(false)
const formattedContent = ref('')

const timestamp = computed(() => {
  const date = new Date(props.message.timestamp)
  return date.toLocaleTimeString()
})

// Render markdown content
watch(() => props.message.content, (content) => {
  if (!content) {
    formattedContent.value = ''
    return
  }

  // For assistant text messages, render as markdown
  if (props.message.role === 'assistant' && props.message.kind === 'text') {
    formattedContent.value = renderMarkdown(content)
  } else {
    formattedContent.value = content
  }
}, { immediate: true })
</script>

<template>
  <div class="message-item">
    <!-- User message -->
    <div v-if="message.role === 'user'" class="flex justify-end">
      <div class="max-w-[80%]">
        <div class="bg-blue-600 text-white rounded-2xl px-4 py-2">
          <div class="text-[14px] leading-relaxed whitespace-pre-wrap">
            {{ message.content }}
          </div>
        </div>
        <div class="text-[10px] text-right mt-1 px-2" style="color: var(--text-tertiary);">
          {{ timestamp }}
        </div>
      </div>
    </div>

    <!-- Assistant text message -->
    <div v-else-if="message.kind === 'text' && message.role === 'assistant'" class="w-full">
      <div class="flex items-start gap-3 mb-2">
        <div class="size-8 rounded-full flex items-center justify-center shrink-0" style="background: var(--accent-muted);">
          <UIcon name="i-lucide-bot" class="size-4" style="color: var(--accent);" />
        </div>
        <span class="text-[13px] font-medium" style="color: var(--text-primary);">Claude</span>
        <span class="text-[10px] ml-auto" style="color: var(--text-tertiary);">
          {{ timestamp }}
        </span>
      </div>
      <div class="ml-11 prose prose-sm max-w-none" style="color: var(--text-primary);" v-html="formattedContent" />
    </div>

    <!-- Thinking block (collapsible) -->
    <div v-else-if="message.kind === 'thinking'" class="w-full">
      <details class="ml-11 group">
        <summary class="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] cursor-pointer hover-bg list-none">
          <UIcon name="i-lucide-chevron-right" class="size-3 transition-transform group-open:rotate-90" style="color: var(--text-disabled);" />
          <UIcon name="i-lucide-brain" class="size-3.5 animate-pulse" style="color: var(--accent);" />
          <span style="color: var(--text-secondary);">Extended thinking...</span>
        </summary>
        <div class="mt-2 p-3 rounded-lg text-[11px] leading-relaxed whitespace-pre-wrap" style="background: var(--surface-raised); color: var(--text-tertiary); font-family: var(--font-mono);">{{ message.content }}</div>
      </details>
    </div>

    <!-- Tool use/progress -->
    <div v-else-if="message.kind === 'tool_use'" class="w-full">
      <div class="ml-11 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]" style="background: var(--surface-raised); border-left: 3px solid var(--accent);">
        <UIcon name="i-lucide-wrench" class="size-3.5 animate-spin" style="color: var(--accent);" />
        <span style="color: var(--text-primary);">{{ message.toolName }}</span>
        <span v-if="message.metadata?.elapsed" class="ml-auto text-[10px]" style="color: var(--text-tertiary);">
          {{ message.metadata.elapsed.toFixed(1) }}s
        </span>
      </div>
    </div>

    <!-- Stream delta (accumulating text) -->
    <div v-else-if="message.kind === 'stream_delta'" class="w-full">
      <!-- This is handled by accumulation in the parent component -->
    </div>

    <!-- Error -->
    <div v-else-if="message.kind === 'error'" class="w-full">
      <div class="ml-11 p-3 rounded-lg flex items-start gap-2" style="background: rgba(205, 49, 49, 0.1); border-left: 3px solid #cd3131;">
        <UIcon name="i-lucide-alert-circle" class="size-4 shrink-0" style="color: #cd3131;" />
        <div class="text-[13px]" style="color: #cd3131;">
          {{ message.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose {
  color: inherit;
}

/* Inline code */
.prose :deep(code.inline-code),
.prose :deep(code:not([class*="language-"])) {
  background: var(--surface-raised);
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.9em;
  font-family: 'Geist Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Menlo, Consolas, 'Courier New', monospace;
  border: 1px solid var(--border-subtle);
}

/* Code blocks */
.prose :deep(pre) {
  background: #1e1e1e;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  margin: 0.5rem 0;
}

.prose :deep(pre code) {
  background: transparent;
  padding: 0;
  border: none;
  color: #d4d4d4;
  font-family: 'Geist Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Menlo, Consolas, 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Shiki generated code blocks */
.prose :deep(pre.shiki),
.prose :deep(pre[class*="language-"]) {
  background: #1e1e1e;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
}

/* Better scrollbar for code blocks */
.prose :deep(pre)::-webkit-scrollbar {
  height: 8px;
}

.prose :deep(pre)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.prose :deep(pre)::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.prose :deep(pre)::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Markdown paragraph spacing */
.prose :deep(p) {
  margin: 0.5rem 0;
}

/* Markdown lists */
.prose :deep(ul),
.prose :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.prose :deep(li) {
  margin: 0.25rem 0;
}

/* Markdown headings */
.prose :deep(h1), .prose :deep(h2), .prose :deep(h3) {
  margin: 1rem 0 0.5rem 0;
  font-weight: 600;
}

.prose :deep(h1) { font-size: 1.5rem; }
.prose :deep(h2) { font-size: 1.25rem; }
.prose :deep(h3) { font-size: 1.1rem; }

/* Markdown blockquotes */
.prose :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 1rem;
  margin: 0.5rem 0;
  font-style: italic;
  opacity: 0.9;
}

/* Markdown links */
.prose :deep(a) {
  color: var(--accent);
  text-decoration: underline;
}

.prose :deep(a:hover) {
  opacity: 0.8;
}
</style>
