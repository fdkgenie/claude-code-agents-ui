<script setup lang="ts">
import type { GithubImport } from '~/types'

const props = defineProps<{
  entry: GithubImport
  type: 'skills' | 'agents'
}>()

const emit = defineEmits<{
  update: [owner: string, repo: string]
  remove: [owner: string, repo: string]
  changed: []
}>()

const { getAvailableItems, updateSelectedItems } = useGithubImports()
const toast = useToast()

const hasUpdate = computed(() => props.entry.currentSha !== props.entry.remoteSha)

const editing = ref(false)
const loadingItems = ref(false)
const saving = ref(false)
const availableItems = ref<{ slug: string; name: string; description: string; selected: boolean }[]>([])
const selectedItems = ref<Set<string>>(new Set())

const allSelected = computed(() => {
  return availableItems.value.length > 0 && selectedItems.value.size === availableItems.value.length
})

async function startEditing() {
  loadingItems.value = true
  editing.value = true
  try {
    const { skills, agents } = await getAvailableItems(props.entry.owner, props.entry.repo, props.type)
    const items = props.type === 'skills' ? skills : agents
    availableItems.value = items
    selectedItems.value = new Set(items.filter(i => i.selected).map(i => i.slug))
  } catch {
    toast.add({ title: 'Failed to load repository items', color: 'error' })
    editing.value = false
  } finally {
    loadingItems.value = false
  }
}

function toggleItem(slug: string) {
  if (selectedItems.value.has(slug)) {
    selectedItems.value.delete(slug)
  } else {
    selectedItems.value.add(slug)
  }
  selectedItems.value = new Set(selectedItems.value)
}

function toggleAll() {
  if (!availableItems.value.length) return
  if (allSelected.value) {
    selectedItems.value = new Set()
  } else {
    selectedItems.value = new Set(availableItems.value.map(i => i.slug))
  }
}

async function saveSelection() {
  saving.value = true
  try {
    await updateSelectedItems(
      props.entry.owner,
      props.entry.repo,
      props.type,
      [...selectedItems.value],
    )
    
    toast.add({
      title: 'Selection updated',
      color: 'success',
    })
    
    editing.value = false
    emit('changed')
  } catch {
    toast.add({ title: 'Failed to update selection', color: 'error' })
  } finally {
    saving.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="rounded-xl overflow-hidden bg-card hover-lift border border-subtle">
    <div class="p-4 space-y-3">
      <div class="flex items-center gap-2.5">
        <div
          class="size-8 rounded-lg flex items-center justify-center shrink-0"
          style="background: var(--badge-subtle-bg); border: 1px solid var(--border-subtle);"
        >
          <UIcon :name="type === 'skills' ? 'i-lucide-sparkles' : 'i-lucide-cpu'" class="size-4 text-label" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-medium truncate">{{ entry.owner }}/{{ entry.repo }}</div>
          <div class="text-[10px] text-meta mt-0.5">
            <strong>{{ entry.totalItems }}</strong> {{ type === 'skills' ? 'skills' : 'agents' }} found,
            <strong>{{ entry.selectedItems?.length || 0 }}</strong> imported
          </div>
        </div>
        <span
          v-if="hasUpdate"
          class="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style="background: rgba(59, 130, 246, 0.1); color: var(--info, #3b82f6);"
        >
          Update available
        </span>
      </div>

      <div class="flex items-center gap-3 text-[10px] text-meta font-mono">
        <span>Imported {{ formatDate(entry.importedAt) }}</span>
        <span>SHA {{ entry.currentSha.slice(0, 7) }}</span>
      </div>

      <!-- Edit selection panel -->
      <div v-if="editing" class="space-y-3 pt-2 border-t mt-3" style="border-color: var(--border-subtle);">
        <div v-if="loadingItems" class="flex items-center justify-center gap-2 py-4">
          <UIcon name="i-lucide-loader-2" class="size-3.5 animate-spin text-meta" />
          <span class="text-[11px] text-label">Loading {{ type }}...</span>
        </div>
        <template v-else>
          <!-- Items List -->
          <div class="max-h-48 overflow-y-auto space-y-0.5 rounded-lg p-1 border" style="background: var(--surface-base); border-color: var(--border-subtle);">
            <label
              v-for="item in availableItems"
              :key="item.slug"
              class="flex items-start gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover-row"
            >
              <input
                type="checkbox"
                :checked="selectedItems.has(item.slug)"
                class="mt-0.5 shrink-0"
                @change="toggleItem(item.slug)"
              />
              <div class="flex-1 min-w-0">
                <span class="text-[12px] font-medium">{{ item.name }}</span>
                <p class="text-[10px] text-label mt-0.5 line-clamp-1">{{ item.description }}</p>
              </div>
            </label>
            <div v-if="availableItems.length === 0" class="py-8 text-center text-[11px] text-meta">No {{ type }} found in this repository</div>
          </div>

          <div class="flex justify-end gap-2">
            <UButton
              :label="allSelected ? 'Deselect all' : 'Select all'"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="toggleAll"
            />
            <UButton label="Cancel" variant="ghost" color="neutral" size="xs" @click="editing = false" />
            <UButton
              :label="`Save (${selectedItems.size})`"
              size="xs"
              :loading="saving"
              @click="saveSelection"
            />
          </div>
        </template>
      </div>
    </div>

    <div class="px-4 py-3 flex items-center justify-between" style="border-top: 1px solid var(--border-subtle);">
      <a
        :href="entry.url"
        target="_blank"
        rel="noopener"
        class="text-[12px] text-meta hover:text-label transition-colors"
      >
        View on GitHub
      </a>
      <div class="flex items-center gap-2">
        <UButton
          v-if="!editing"
          label="Edit selection"
          icon="i-lucide-settings-2"
          size="xs"
          variant="ghost"
          color="neutral"
          @click="startEditing"
        />
        <UButton
          v-if="hasUpdate"
          label="Update"
          icon="i-lucide-download"
          size="xs"
          variant="soft"
          @click="emit('update', entry.owner, entry.repo)"
        />
        <UButton
          label="Remove"
          icon="i-lucide-trash-2"
          size="xs"
          variant="ghost"
          color="error"
          @click="emit('remove', entry.owner, entry.repo)"
        />
      </div>
    </div>
  </div>
</template>
