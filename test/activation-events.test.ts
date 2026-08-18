import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface ExtensionManifest {
  activationEvents: string[]
  contributes: {
    commands: Array<{ command: string }>
  }
}

const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest

const dependencyFileEvents = [
  'workspaceContains:**/package.json',
  'workspaceContains:**/requirements.txt',
  'workspaceContains:**/pyproject.toml',
  'workspaceContains:**/go.mod',
  'workspaceContains:**/pom.xml',
]

describe('extension activation events', () => {
  it('activates only for supported dependency files or contributed commands', () => {
    const commandEvents = manifest.contributes.commands
      .map(({ command }) => `onCommand:${command}`)

    expect(manifest.activationEvents).toEqual([
      ...dependencyFileEvents,
      ...commandEvents,
    ])
  })

  it('does not activate at startup or for broad language types', () => {
    expect(manifest.activationEvents).not.toContain('onStartupFinished')
    expect(manifest.activationEvents.some(event => event.startsWith('onLanguage:'))).toBe(false)
  })

  it('does not expose the removed bulk-update command', () => {
    expect(manifest.activationEvents).not.toContain('onCommand:depdetect.updateAll')
    expect(manifest.contributes.commands.map(({ command }) => command))
      .not.toContain('depdetect.updateAll')
  })
})
