<script setup lang="ts">
const contextMonitor = useContextMonitor()
provide('contextMonitor', contextMonitor)

const activeTab = ref<'metrics' | 'files' | 'tools' | 'history'>('metrics')

// Start monitoring
onMounted(() => {
  contextMonitor.startMonitoring()
})

onUnmounted(() => {
  contextMonitor.stopMonitoring()
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <!-- Tabs -->
    <div class="shrink-0 border-b" style="border-color: var(--border-subtle);">
      <div class="flex" style="border-color: var(--border-subtle);">
        <button
          class="flex-1 px-4 py-2 text-[12px] font-medium transition-all border-b-2"
          :class="{ 'border-accent': activeTab === 'metrics' }"
          :style="{
            color: activeTab === 'metrics' ? 'var(--accent)' : 'var(--text-secondary)',
            borderColor: activeTab === 'metrics' ? 'var(--accent)' : 'transparent',
            background: activeTab === 'metrics' ? 'var(--surface-raised)' : 'transparent',
          }"
          @click="activeTab = 'metrics'"
        >
          <UIcon name="i-lucide-bar-chart-3" class="size-3.5 inline-block mr-1" />
          Metrics
        </button>
        <button
          class="flex-1 px-4 py-2 text-[12px] font-medium transition-all border-b-2"
          :class="{ 'border-accent': activeTab === 'files' }"
          :style="{
            color: activeTab === 'files' ? 'var(--accent)' : 'var(--text-secondary)',
            borderColor: activeTab === 'files' ? 'var(--accent)' : 'transparent',
            background: activeTab === 'files' ? 'var(--surface-raised)' : 'transparent',
          }"
          @click="activeTab = 'files'"
        >
          <UIcon name="i-lucide-file-text" class="size-3.5 inline-block mr-1" />
          Files
          <span v-if="contextMonitor.totalFileChanges.value > 0" class="ml-1 px-1.5 py-0.5 rounded-full text-[10px]" style="background: var(--accent); color: white;">
            {{ contextMonitor.totalFileChanges.value }}
          </span>
        </button>
        <button
          class="flex-1 px-4 py-2 text-[12px] font-medium transition-all border-b-2"
          :class="{ 'border-accent': activeTab === 'tools' }"
          :style="{
            color: activeTab === 'tools' ? 'var(--accent)' : 'var(--text-secondary)',
            borderColor: activeTab === 'tools' ? 'var(--accent)' : 'transparent',
            background: activeTab === 'tools' ? 'var(--surface-raised)' : 'transparent',
          }"
          @click="activeTab = 'tools'"
        >
          <UIcon name="i-lucide-wrench" class="size-3.5 inline-block mr-1" />
          Tools
          <span v-if="contextMonitor.totalToolCalls.value > 0" class="ml-1 px-1.5 py-0.5 rounded-full text-[10px]" style="background: var(--accent); color: white;">
            {{ contextMonitor.totalToolCalls.value }}
          </span>
        </button>
        <button
          class="flex-1 px-4 py-2 text-[12px] font-medium transition-all border-b-2"
          :class="{ 'border-accent': activeTab === 'history' }"
          :style="{
            color: activeTab === 'history' ? 'var(--accent)' : 'var(--text-secondary)',
            borderColor: activeTab === 'history' ? 'var(--accent)' : 'transparent',
            background: activeTab === 'history' ? 'var(--surface-raised)' : 'transparent',
          }"
          @click="activeTab = 'history'"
        >
          <UIcon name="i-lucide-history" class="size-3.5 inline-block mr-1" />
          History
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-auto" style="background: var(--surface-base);">
      <MetricsCard v-if="activeTab === 'metrics'" :metrics="contextMonitor.metrics.value" />
      <FileTree v-else-if="activeTab === 'files'" :files="contextMonitor.metrics.value.files" />
      <ToolTimeline v-else-if="activeTab === 'tools'" :tools="contextMonitor.recentToolCalls.value" />
      <SessionHistory v-else-if="activeTab === 'history'" />
    </div>
  </div>
</template>
