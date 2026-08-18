import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPackageData } from '../../src/api'
import type Item from '../../src/core/Item'

const mocks = vi.hoisted(() => ({
  version: vi.fn(),
}))

vi.mock('../../src/api/cache', () => ({
  loadCache: () => ({
    'npm:cached-package': {
      cacheTime: Date.now(),
      data: ['1.0.0'],
    },
  }),
  dumpCache: vi.fn(),
}))

vi.mock('../../src/api/version', () => ({
  version: mocks.version,
}))

const item = {
  key: 'cached-package',
  value: '1.0.0',
  registry: 'npm',
} as Item

describe('package data force refresh', () => {
  beforeEach(() => mocks.version.mockReset())

  it('prefers a valid cache entry for an ordinary request', async () => {
    await expect(getPackageData(item, 'C:\\workspace', false)).resolves.toEqual({
      version: ['1.0.0'],
    })
    expect(mocks.version).not.toHaveBeenCalled()
  })

  it('bypasses a valid cache entry only when forceFresh is explicit', async () => {
    mocks.version.mockResolvedValue(['2.0.0'])

    await expect(getPackageData(item, 'C:\\workspace', true)).resolves.toEqual({
      version: ['2.0.0'],
    })
    expect(mocks.version).toHaveBeenCalledOnce()
  })
})
