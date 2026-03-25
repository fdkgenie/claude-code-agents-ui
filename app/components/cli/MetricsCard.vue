<script setup lang="ts">
import type { ContextMetrics } from '~/types'

const props = defineProps<{
  metrics: ContextMetrics
}>()

const contextColor = computed(() => {
  const percentage = props.metrics.contextWindow.percentage
  if (percentage < 50) return '#0dbc79'
  if (percentage < 75) return '#e5e510'
  if (percentage < 90) return '#ff9f1c'
  return '#cd3131'
})
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Token Usage -->
    <div class="p-4 rounded-lg" style="background: var(--surface-raised);">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[13px] font-semibold" style="color: var(--text-primary);">
          <UIcon name="i-lucide-layers" class="size-4 inline-block mr-1.5" />
          Token Usage
        </h3>
      </div>

      <div class="space-y-2">
        <!-- Input Tokens -->
        <div>
          <div class="flex justify-between text-[11px] mb-1">
            <span style="color: var(--text-secondary);">Input</span>
            <span class="font-mono" style="color: var(--text-primary);">{{ metrics.tokens.input.toLocaleString() }}</span>
          </div>
          <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--surface-base);">
            <div
              class="h-full rounded-full transition-all duration-300"
              :style="{ width: `${Math.min(100, (metrics.tokens.input / metrics.contextWindow.total) * 100)}%`, background: '#2472c8' }"
            />
          </div>
        </div>

        <!-- Output Tokens -->
        <div>
          <div class="flex justify-between text-[11px] mb-1">
            <span style="color: var(--text-secondary);">Output</span>
            <span class="font-mono" style="color: var(--text-primary);">{{ metrics.tokens.output.toLocaleString() }}</span>
          </div>
          <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--surface-base);">
            <div
              class="h-full rounded-full transition-all duration-300"
              :style="{ width: `${Math.min(100, (metrics.tokens.output / metrics.contextWindow.total) * 100)}%`, background: '#0dbc79' }"
            />
          </div>
        </div>

        <!-- Cached Tokens -->
        <div>
          <div class="flex justify-between text-[11px] mb-1">
            <span style="color: var(--text-secondary);">Cached</span>
            <span class="font-mono" style="color: var(--text-primary);">{{ metrics.tokens.cached.toLocaleString() }}</span>
          </div>
          <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--surface-base);">
            <div
              class="h-full rounded-full transition-all duration-300"
              :style="{ width: `${Math.min(100, (metrics.tokens.cached / metrics.contextWindow.total) * 100)}%`, background: '#bc3fbc' }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Context Window -->
    <div class="p-4 rounded-lg" style="background: var(--surface-raised);">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[13px] font-semibold" style="color: var(--text-primary);">
          <UIcon name="i-lucide-gauge" class="size-4 inline-block mr-1.5" />
          Context Window
        </h3>
        <span class="text-[11px] font-mono" :style="{ color: contextColor }">
          {{ metrics.contextWindow.percentage.toFixed(1) }}%
        </span>
      </div>

      <div class="h-2.5 rounded-full overflow-hidden mb-2" style="background: var(--surface-base);">
        <div
          class="h-full rounded-full transition-all duration-300"
          :style="{ width: `${metrics.contextWindow.percentage}%`, background: contextColor }"
        />
      </div>

      <div class="flex justify-between text-[11px]">
        <span style="color: var(--text-secondary);">Used</span>
        <span class="font-mono" style="color: var(--text-primary);">
          {{ metrics.contextWindow.used.toLocaleString() }} / {{ metrics.contextWindow.total.toLocaleString() }}
        </span>
      </div>
    </div>

    <!-- Cost Tracking -->
    <div class="p-4 rounded-lg" style="background: var(--surface-raised);">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[13px] font-semibold" style="color: var(--text-primary);">
          <UIcon name="i-lucide-dollar-sign" class="size-4 inline-block mr-1.5" />
          Cost Tracking
        </h3>
        <span class="text-[15px] font-mono font-semibold" style="color: var(--accent);">
          ${{ metrics.cost.total.toFixed(4) }}
        </span>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between text-[11px]">
          <span style="color: var(--text-secondary);">Input Cost</span>
          <span class="font-mono" style="color: var(--text-primary);">${{ metrics.cost.input.toFixed(4) }}</span>
        </div>
        <div class="flex justify-between text-[11px]">
          <span style="color: var(--text-secondary);">Output Cost</span>
          <span class="font-mono" style="color: var(--text-primary);">${{ metrics.cost.output.toFixed(4) }}</span>
        </div>
        <div class="flex justify-between text-[11px]">
          <span style="color: var(--text-secondary);">Cache Cost</span>
          <span class="font-mono" style="color: var(--text-primary);">${{ metrics.cost.cached.toFixed(4) }}</span>
        </div>
      </div>

      <div class="mt-3 pt-3 border-t text-[10px]" style="border-color: var(--border-subtle); color: var(--text-tertiary);">
        * Estimated costs based on current pricing
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-2 gap-3">
      <div class="p-3 rounded-lg text-center" style="background: var(--surface-raised);">
        <div class="text-[20px] font-bold mb-1" style="color: var(--text-primary);">
          {{ (metrics.files.created.length + metrics.files.modified.length + metrics.files.deleted.length) }}
        </div>
        <div class="text-[10px]" style="color: var(--text-secondary);">File Changes</div>
      </div>
      <div class="p-3 rounded-lg text-center" style="background: var(--surface-raised);">
        <div class="text-[20px] font-bold mb-1" style="color: var(--text-primary);">
          {{ metrics.tools.length }}
        </div>
        <div class="text-[10px]" style="color: var(--text-secondary);">Tool Calls</div>
      </div>
    </div>
  </div>
</template>
