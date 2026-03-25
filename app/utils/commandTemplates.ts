import type { CommandFrontmatter } from '~/types'

export interface CommandTemplate {
  id: string
  icon: string
  frontmatter: CommandFrontmatter
  body: string
  directory?: string
}

export const commandTemplates: CommandTemplate[] = [
  {
    id: 'commit',
    icon: 'i-lucide-git-commit-horizontal',
    frontmatter: {
      name: 'commit',
      description: 'Stage changes and create a well-formatted commit message.',
    },
    body: `Review the current git diff and staged changes. Create a commit with a clear, conventional commit message.

Rules:
- Use conventional commit format: type(scope): description
- Types: feat, fix, refactor, docs, style, test, chore
- Keep the first line under 72 characters
- Add a body if the change needs explanation
- Stage only related files — don't mix unrelated changes
- Ask before committing if anything looks unusual`,
  },
  {
    id: 'review',
    icon: 'i-lucide-scan-eye',
    frontmatter: {
      name: 'review',
      description: 'Review recent changes for bugs, style issues, and improvements.',
      'argument-hint': 'file or branch',
    },
    body: `Review the specified code changes (or the current git diff if nothing specified).

Check for:
1. Bugs and logic errors
2. Security issues (injection, auth, data leaks)
3. Performance problems
4. Style inconsistencies
5. Missing error handling

Format: List issues by severity (critical > warning > suggestion). Include file and line references.`,
  },
  {
    id: 'test',
    icon: 'i-lucide-flask-conical',
    frontmatter: {
      name: 'test',
      description: 'Run tests and report results with suggestions for failures.',
      'argument-hint': 'test file or pattern',
    },
    body: `Run the project's test suite (or specific tests if specified).

Steps:
1. Identify the test runner (jest, vitest, pytest, etc.)
2. Run the tests
3. Report results: passed, failed, skipped
4. For failures: show the error, explain the likely cause, suggest a fix
5. If no tests exist for the specified area, suggest what to test`,
  },
  {
    id: 'explain',
    icon: 'i-lucide-book-open',
    frontmatter: {
      name: 'explain',
      description: 'Explain how a file, function, or system works.',
      'argument-hint': 'file or concept',
    },
    body: `Explain the specified code or concept in plain language.

Structure your explanation:
1. **What it does** — one sentence summary
2. **How it works** — step-by-step walkthrough
3. **Why it's designed this way** — key design decisions
4. **Connections** — what calls it, what it depends on

Adjust detail level to the complexity. Simple functions get brief explanations. Complex systems get diagrams and examples.`,
  },
]
