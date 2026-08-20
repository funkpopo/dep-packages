import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createDecorationType: vi.fn(),
  buildDecoration: vi.fn(),
  statusBarItem: {
    setText: vi.fn(),
  },
}))

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}))

vi.mock('../src/ui/decoration', () => ({
  createDecorationType: mocks.createDecorationType,
  default: mocks.buildDecoration,
}))

vi.mock('../src/ui/indicators', () => ({
  statusBarItem: mocks.statusBarItem,
}))

import decorate, {
  clearDocumentDecorations,
  initializeDecoration,
} from '../src/ui/decorator'

describe('decoration lifecycle', () => {
  beforeEach(() => {
    mocks.createDecorationType.mockReset()
    mocks.buildDecoration.mockReset()
    mocks.statusBarItem.setText.mockReset()
  })

  it('creates one shared type and reuses it across editor refreshes', () => {
    const handle = { dispose: vi.fn() }
    mocks.createDecorationType.mockReturnValue(handle)
    const context = { subscriptions: { push: vi.fn() } }
    const editorA = {
      document: { uri: { toString: () => 'file:///workspace/a/package.json' } },
      setDecorations: vi.fn(),
    }
    const editorB = {
      document: { uri: { toString: () => 'file:///workspace/b/package.json' } },
      setDecorations: vi.fn(),
    }

    initializeDecoration(context as never)
    initializeDecoration(context as never)
    decorate(editorA as never, [])
    decorate(editorA as never, [])
    decorate(editorB as never, [])
    clearDocumentDecorations(editorA as never)

    expect(mocks.createDecorationType).toHaveBeenCalledTimes(1)
    expect(context.subscriptions.push).toHaveBeenCalledTimes(1)
    expect(context.subscriptions.push).toHaveBeenCalledWith(handle)
    expect(handle.dispose).not.toHaveBeenCalled()
    expect(editorA.setDecorations).toHaveBeenCalledTimes(3)
    expect(editorB.setDecorations).toHaveBeenCalledTimes(1)
    expect(editorA.setDecorations.mock.calls.every(([type]) => type === handle)).toBe(true)
    expect(editorB.setDecorations.mock.calls[0][0]).toBe(handle)
    expect(editorA.setDecorations.mock.lastCall?.[1]).toEqual([])
  })
})
