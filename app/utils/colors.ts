export const agentColorMap: Record<string, string> = {
  pink: '#ec4899',
  orange: '#f97316',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  purple: '#a855f7',
  yellow: '#eab308',
  red: '#ef4444',
}

export const modelColors: Record<string, { bg: string; text: string; label: string }> = {
  opus: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'opus' },
  sonnet: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'sonnet' },
  haiku: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'haiku' },
}

export function getAgentColor(color: string | undefined): string {
  return agentColorMap[color || ''] || '#71717a'
}
