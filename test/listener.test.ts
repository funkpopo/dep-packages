import { describe, expect, it, vi } from 'vitest'
import type Item from '../src/core/Item'
import listener from '../src/core/listener'

const mocks = vi.hoisted(() => ({
  fetchPackageVersions: vi.fn(),
  decorate: vi.fn(),
  statusBarItem: {
    show: vi.fn(),
    hide: vi.fn(),
    setText: vi.fn(),
  },
}))

vi.mock('vscode', () => ({
  Range: class {},
  window: {},
  workspace: {},
}))

vi.mock('../src/commands/commands', () => ({
  status: {
    inProgress: false,
    replaceItems: [],
  },
}))

vi.mock('../src/core/fetcher', () => ({
  fetchPackageVersions: mocks.fetchPackageVersions,
}))

vi.mock('../src/ui/decorator', () => ({
  default: mocks.decorate,
  decorationHandle: undefined,
}))

vi.mock('../src/ui/indicators', () => ({
  statusBarItem: mocks.statusBarItem,
}))

mocks.fetchPackageVersions.mockImplementation(async (items: Item[]) => {
  const fetched = items.map(item => ({
    item,
    versions: ['2.0.0'],
  }))
  return [fetched, new Map()]
})

describe('package document listener', () => {
  it('does not fetch again for edits, saves, or reopening the same document', async () => {
    let text = `{
  "dependencies": {
    "example": "1.0.0"
  }
}`
    const document = {
      uri: { toString: () => 'file:///workspace/package.json' },
      fileName: 'package.json',
      getText: () => text,
    }
    const editor = { document } as never

    await listener(editor)
    expect(mocks.fetchPackageVersions).toHaveBeenCalledTimes(1)

    text = text.replace('1.0.0', '1.1.0')
    await listener(editor, { fetch: false })
    await listener(editor)
    expect(mocks.fetchPackageVersions).toHaveBeenCalledTimes(1)

    await listener(editor, { forceFetch: true })
    expect(mocks.fetchPackageVersions).toHaveBeenCalledTimes(2)
  })
})
