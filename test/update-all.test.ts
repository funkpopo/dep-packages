import type { TextEditor, TextEditorEdit } from 'vscode'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDocumentSession, documentSessions } from '../src/core/DocumentSession'
import '../src/commands/commands'

const vscodeMocks = vi.hoisted(() => {
  class TestRange {
    constructor(
      public readonly start: number,
      public readonly end: number,
    ) {}
  }

  const handlers = new Map<string, unknown>()
  const listener = vi.fn()
  return { TestRange, handlers, listener }
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
  default: vscodeMocks.listener,
}))

const updateAll = vscodeMocks.handlers.get('depdetect.updateAll') as (
  editor: TextEditor,
  edit: TextEditorEdit,
) => void
const retry = vscodeMocks.handlers.get('depdetect.retry') as (editor: TextEditor) => void

describe('update all command', () => {
  beforeEach(() => {
    documentSessions.clear()
    vscodeMocks.listener.mockClear()
  })

  function setReplacements(editor: TextEditor, replacements: Array<{ item: string, start: number, end: number, plain?: boolean }>) {
    const session = createDocumentSession(editor.document)
    session.replaceItems = replacements
    documentSessions.set(editor.document.uri.toString(), session)
  }

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
        uri: { toString: () => 'file:///workspace/package.json' },
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

    setReplacements(editor, replacements)
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
        uri: { toString: () => 'file:///workspace/go.mod' },
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

    setReplacements(editor, [
      { item: 'v1.5.0', start: firstStart, end: firstStart + 'v1.0.0'.length, plain: true },
      { item: 'v2.4.0', start: secondStart, end: secondStart + 'v2.0.0'.length, plain: true },
    ])
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

  it('updates version text in pom.xml files without changing XML tags', () => {
    const source = '<dependency><version>1.0.0</version></dependency>'
    const start = source.indexOf('1.0.0')
    const appliedRanges: Array<{ start: number, end: number, text: string }> = []
    const editor = {
      document: {
        uri: { toString: () => 'file:///workspace/pom.xml' },
        fileName: 'C:\\workspace\\pom.xml',
        positionAt: (offset: number) => offset,
        save: () => Promise.resolve(true),
      },
    } as unknown as TextEditor
    const edit = {
      replace: (range: { start: number, end: number }, text: string) => {
        appliedRanges.push({ ...range, text })
      },
    } as unknown as TextEditorEdit

    setReplacements(editor, [{ item: '2.0.0', start, end: start + '1.0.0'.length, plain: true }])
    updateAll(editor, edit)

    expect(appliedRanges).toEqual([{ start, end: start + '1.0.0'.length, text: '2.0.0' }])
  })

  it('only applies replacements from the active document session', () => {
    const makeEditor = (uri: string) => ({
      document: {
        uri: { toString: () => uri },
        fileName: 'package.json',
        positionAt: (offset: number) => offset,
        save: () => Promise.resolve(true),
      },
    }) as unknown as TextEditor
    const editorA = makeEditor('file:///workspace/a/package.json')
    const editorB = makeEditor('file:///workspace/b/package.json')
    setReplacements(editorA, [{ item: 'from-a', start: 100, end: 110 }])
    setReplacements(editorB, [{ item: 'from-b', start: 10, end: 20 }])
    const applied: Array<{ start: number, end: number, text: string }> = []
    const edit = {
      replace: (range: { start: number, end: number }, text: string) => applied.push({ ...range, text }),
    } as unknown as TextEditorEdit

    updateAll(editorB, edit)

    expect(applied).toEqual([{ start: 10, end: 20, text: 'from-b' }])
  })

  it('passes forceFresh explicitly when retrying the active document', () => {
    const editor = { document: {} } as TextEditor

    retry(editor)

    expect(vscodeMocks.listener).toHaveBeenCalledWith(editor, { forceFresh: true })
  })
})
