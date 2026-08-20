import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => {
  class MarkdownString {
    value = ''
    isTrusted = false

    constructor(value = '') {
      this.value = value
    }

    appendMarkdown(value: string) {
      this.value += value
      return this
    }

    appendText(value: string) {
      this.value += value
      return this
    }
  }

  class Range {
    constructor(
      public readonly start: unknown,
      public readonly end: unknown,
    ) {}
  }

  return { MarkdownString, Range }
})

import decoration from '../src/ui/decoration'

describe('decoration purity', () => {
  it('does not edit or save a document when its version is ?', () => {
    const text = '{ "dependencies": { "example": "?" } }'
    const document = {
      lineAt: vi.fn(() => ({
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: text.length } },
        text,
      })),
      positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
      save: vi.fn(),
    }
    const editor = {
      document,
      edit: vi.fn(),
    }
    const item = {
      key: 'example',
      values: [],
      value: '?',
      start: 31,
      end: 32,
      registry: 'npm' as const,
      plainVersion: false,
      replacePrefix: '',
    }

    const result = decoration(
      editor as never,
      item,
      ['2.0.0'],
      '✅',
      '❌ ${version}',
      '❗️',
    )

    expect(result.hoverMessage).toBeDefined()
    expect((result.hoverMessage as { value: string }).value).toContain('command:depdetect.replaceVersion')
    expect(editor.edit).not.toHaveBeenCalled()
    expect(document.save).not.toHaveBeenCalled()
  })
})
