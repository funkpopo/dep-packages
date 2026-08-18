import type { TextEditor, TextEditorEdit } from 'vscode'
import { describe, expect, it, vi } from 'vitest'
import { status } from '../src/commands/commands'

const vscodeMocks = vi.hoisted(() => {
  class TestRange {
    constructor(
      public readonly start: number,
      public readonly end: number,
    ) {}
  }

  const handlers = new Map<string, unknown>()
  return { TestRange, handlers }
})

vi.mock('vscode', () => ({
  Range: vscodeMocks.TestRange,
  commands: {
    registerTextEditorCommand: (name: string, handler: unknown) => {
      vscodeMocks.handlers.set(name, handler)
      return { dispose: () => {} }
    },
  },
}))

vi.mock('../src/core/listener', () => ({
  default: vi.fn(),
}))

vi.mock('../src/api', () => ({
  freshChecker: {
    needFresh: false,
    set: vi.fn(),
  },
}))

const updateAll = vscodeMocks.handlers.get('depdetect.updateAll') as (
  editor: TextEditor,
  edit: TextEditorEdit,
) => void

describe('update all command', () => {
  it('preserves commas after dependency values', () => {
    const source = `{
  "dependencies": {
    "first": "1.0.0",
    "second": "1.0.0"
  }
}`
    const firstStart = source.indexOf('"1.0.0"')
    const secondStart = source.indexOf('"1.0.0"', firstStart + 1)
    const valueLength = '"1.0.0"'.length
    const replacements = [
      { item: '"2.0.0"', start: firstStart, end: firstStart + valueLength },
      { item: '"2.0.0"', start: secondStart, end: secondStart + valueLength },
    ]
    const appliedRanges: Array<{ start: number, end: number, text: string }> = []

    const editor = {
      document: {
        fileName: 'package.json',
        positionAt: (offset: number) => offset,
        save: () => Promise.resolve(true),
      },
    } as unknown as TextEditor
    const edit = {
      replace: (range: { start: number, end: number }, text: string) => {
        appliedRanges.push({ ...range, text })
      },
    } as unknown as TextEditorEdit

    status.inProgress = false
    status.replaceItems = replacements
    updateAll(editor, edit)

    const updated = appliedRanges
      .sort((a, b) => b.start - a.start)
      .reduce(
        (text, replacement) => text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end),
        source,
      )

    expect(JSON.parse(updated)).toEqual({
      dependencies: {
        first: '2.0.0',
        second: '2.0.0',
      },
    })
  })

  it('updates plain versions in go.mod files', () => {
    const source = `require (
\texample.com/first v1.0.0
\texample.com/second/v2 v2.0.0 // indirect
)
`
    const firstStart = source.indexOf('v1.0.0')
    const secondStart = source.indexOf('v2.0.0')
    const appliedRanges: Array<{ start: number, end: number, text: string }> = []
    const editor = {
      document: {
        fileName: 'go.mod',
        positionAt: (offset: number) => offset,
        save: () => Promise.resolve(true),
      },
    } as unknown as TextEditor
    const edit = {
      replace: (range: { start: number, end: number }, text: string) => {
        appliedRanges.push({ ...range, text })
      },
    } as unknown as TextEditorEdit

    status.inProgress = false
    status.replaceItems = [
      { item: 'v1.5.0', start: firstStart, end: firstStart + 'v1.0.0'.length, plain: true },
      { item: 'v2.4.0', start: secondStart, end: secondStart + 'v2.0.0'.length, plain: true },
    ]
    updateAll(editor, edit)

    const updated = appliedRanges
      .sort((a, b) => b.start - a.start)
      .reduce(
        (text, replacement) => `${text.slice(0, replacement.start)}${replacement.text}${text.slice(replacement.end)}`,
        source,
      )
    expect(updated).toContain('example.com/first v1.5.0')
    expect(updated).toContain('example.com/second/v2 v2.4.0 // indirect')
  })
})
