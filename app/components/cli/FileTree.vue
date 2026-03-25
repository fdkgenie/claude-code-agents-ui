<script setup lang="ts">
import type { FileChange } from '~/types'

const props = defineProps<{
  files: {
    created: FileChange[]
    modified: FileChange[]
    deleted: FileChange[]
  }
}>()

const allChanges = computed(() => {
  const changes = [
    ...props.files.created.map((f) => ({ ...f, type: 'created' as const })),
    ...props.files.modified.map((f) => ({ ...f, type: 'modified' as const })),
    ...props.files.deleted.map((f) => ({ ...f, type: 'deleted' as const })),
  ]
  return changes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
})

function getChangeIcon(type: string) {
  switch (type) {
    case 'created':
      return 'i-lucide-plus-circle'
    case 'modified':
      return 'i-lucide-pencil'
    case 'deleted':
      return 'i-lucide-trash-2'
    default:
      return 'i-lucide-file'
  }
}

function getChangeColor(type: string) {
  switch (type) {
    case 'created':
      return '#0dbc79'
    case 'modified':
      return '#e5e510'
    case 'deleted':
      return '#cd3131'
    default:
      return 'var(--text-secondary)'
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

function formatSize(bytes?: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="p-4">
    <div v-if="allChanges.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-folder-open" class="size-12 mx-auto mb-3" style="color: var(--text-disabled);" />
      <p class="text-[13px]" style="color: var(--text-secondary);">No file changes yet</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(change, index) in allChanges"
        :key="`${change.path}-${index}`"
        class="p-3 rounded-lg flex items-start gap-3"
        style="background: var(--surface-raised);"
      >
        <UIcon :name="getChangeIcon(change.type)" class="size-4 mt-0.5 shrink-0" :style="{ color: getChangeColor(change.type) }" />
        <div class="flex-1 min-w-0">
          <div class="text-[12px] font-mono truncate mb-1" style="color: var(--text-primary);">
            {{ change.path }}
          </div>
          <div class="flex items-center gap-3 text-[10px]" style="color: var(--text-tertiary);">
            <span>{{ formatTimestamp(change.timestamp) }}</span>
            <span v-if="change.size">{{ formatSize(change.size) }}</span>
            <span class="px-1.5 py-0.5 rounded capitalize" :style="{ background: `${getChangeColor(change.type)}15`, color: getChangeColor(change.type) }">
              {{ change.type }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
