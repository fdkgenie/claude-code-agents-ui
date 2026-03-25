<script setup lang="ts">
import type { ToolCall } from '~/types'

const props = defineProps<{
  tools: ToolCall[]
}>()

function getStatusColor(status: string) {
  switch (status) {
    case 'success':
      return '#0dbc79'
    case 'error':
      return '#cd3131'
    case 'running':
      return '#e5e510'
    default:
      return 'var(--text-secondary)'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return 'i-lucide-check-circle'
    case 'error':
      return 'i-lucide-x-circle'
    case 'running':
      return 'i-lucide-loader-2'
    default:
      return 'i-lucide-circle'
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

function formatDuration(ms?: number) {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getToolIcon(toolName: string) {
  const icons: Record<string, string> = {
    Read: 'i-lucide-file-text',
    Write: 'i-lucide-file-plus',
    Edit: 'i-lucide-pencil',
    Bash: 'i-lucide-terminal',
    Glob: 'i-lucide-search',
    Grep: 'i-lucide-search-code',
  }
  return icons[toolName] || 'i-lucide-wrench'
}
</script>

<template>
  <div class="p-4">
    <div v-if="tools.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-wrench" class="size-12 mx-auto mb-3" style="color: var(--text-disabled);" />
      <p class="text-[13px]" style="color: var(--text-secondary);">No tool calls yet</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(tool, index) in tools"
        :key="`${tool.toolName}-${index}`"
        class="p-3 rounded-lg"
        style="background: var(--surface-raised);"
      >
        <div class="flex items-start gap-3">
          <!-- Status Indicator -->
          <div class="shrink-0 mt-0.5">
            <UIcon
              :name="getStatusIcon(tool.status)"
              class="size-4"
              :class="{ 'animate-spin': tool.status === 'running' }"
              :style="{ color: getStatusColor(tool.status) }"
            />
          </div>

          <!-- Tool Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <UIcon :name="getToolIcon(tool.toolName)" class="size-3.5" style="color: var(--text-secondary);" />
              <span class="text-[13px] font-semibold" style="color: var(--text-primary);">
                {{ tool.toolName }}
              </span>
              <span v-if="tool.elapsed" class="text-[10px] font-mono px-1.5 py-0.5 rounded" style="background: var(--surface-base); color: var(--text-secondary);">
                {{ formatDuration(tool.elapsed) }}
              </span>
            </div>

            <div v-if="tool.args" class="text-[11px] font-mono mb-1 truncate" style="color: var(--text-secondary);">
              {{ tool.args }}
            </div>

            <div class="text-[10px]" style="color: var(--text-tertiary);">
              {{ formatTimestamp(tool.timestamp) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
