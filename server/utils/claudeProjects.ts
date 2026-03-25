import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'
import { createReadStream } from 'node:fs'

export interface ClaudeProject {
  name: string
  displayName: string
  path: string
  sessionsCount: number
}

export interface ClaudeSession {
  id: string
  summary: string
  lastActivity: string
  messageCount: number
}

/**
 * Get Claude projects directory
 */
function getProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects')
}

/**
 * Decode project name to path
 * Example: -Users-liamnguyen-Documents-agents-ui -> /Users/liamnguyen/Documents/agents-ui
 */
function decodeProjectName(encodedName: string): string {
  return encodedName.replace(/^-/, '/').replace(/-/g, '/')
}

/**
 * Get display name from project path
 */
function getDisplayName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || projectPath
}

/**
 * List all Claude Code projects
 */
export async function listProjects(): Promise<ClaudeProject[]> {
  try {
    const projectsDir = getProjectsDir()

    // Check if directory exists
    try {
      await fs.access(projectsDir)
    } catch {
      return []
    }

    const entries = await fs.readdir(projectsDir, { withFileTypes: true })
    const projects: ClaudeProject[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const projectPath = decodeProjectName(entry.name)
      const projectDir = path.join(projectsDir, entry.name)

      // Count sessions (.jsonl files, excluding agent-*.jsonl)
      const files = await fs.readdir(projectDir)
      const sessionFiles = files.filter(file =>
        file.endsWith('.jsonl') && !file.startsWith('agent-')
      )

      projects.push({
        name: entry.name,
        displayName: getDisplayName(projectPath),
        path: projectPath,
        sessionsCount: sessionFiles.length,
      })
    }

    return projects
  } catch (error) {
    console.error('[Claude Projects] Error listing projects:', error)
    return []
  }
}

/**
 * List sessions for a project
 */
export async function listSessions(projectName: string): Promise<ClaudeSession[]> {
  try {
    const projectDir = path.join(getProjectsDir(), projectName)

    const files = await fs.readdir(projectDir)
    const jsonlFiles = files.filter(file =>
      file.endsWith('.jsonl') && !file.startsWith('agent-')
    )

    if (jsonlFiles.length === 0) {
      return []
    }

    // Get file stats and sort by modification time
    const filesWithStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(projectDir, file)
        const stats = await fs.stat(filePath)
        return { file, mtime: stats.mtime }
      })
    )
    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    // Parse sessions
    const sessions: ClaudeSession[] = []

    for (const { file, mtime } of filesWithStats) {
      const sessionId = file.replace('.jsonl', '')
      const filePath = path.join(projectDir, file)

      // Read first few lines to get summary
      let summary = 'New Session'
      let messageCount = 0

      try {
        const fileStream = createReadStream(filePath)
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        })

        for await (const line of rl) {
          if (!line.trim()) continue
          messageCount++

          try {
            const entry = JSON.parse(line)

            // Find first user message for summary
            if (!summary || summary === 'New Session') {
              if (entry.message?.role === 'user') {
                const content = Array.isArray(entry.message.content)
                  ? entry.message.content.find((c: any) => c.type === 'text')?.text
                  : entry.message.content

                if (content && typeof content === 'string') {
                  summary = content.length > 50
                    ? content.substring(0, 50) + '...'
                    : content
                }
              }
            }

            // Early exit after finding summary and counting ~10 messages
            if (summary !== 'New Session' && messageCount > 10) {
              break
            }
          } catch {
            // Skip malformed lines
          }
        }

        rl.close()
      } catch (error) {
        console.error(`Error reading session ${sessionId}:`, error)
      }

      sessions.push({
        id: sessionId,
        summary,
        lastActivity: mtime.toISOString(),
        messageCount,
      })
    }

    return sessions
  } catch (error) {
    console.error('[Claude Projects] Error listing sessions:', error)
    return []
  }
}

/**
 * Get the current project name for a given directory path
 */
export function getProjectName(projectPath: string): string {
  return projectPath.replace(/\//g, '-').replace(/^-/, '-')
}
