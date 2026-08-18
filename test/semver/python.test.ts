import { describe, expect, it } from 'vitest'
import { comparePythonVersions, isStablePythonVersion } from '../../src/semver/python'

describe('python versions', () => {
  it('filters pre-releases while retaining stable and post releases', () => {
    expect(isStablePythonVersion('2.1.0b3')).toBe(false)
    expect(isStablePythonVersion('9.0.0rc1')).toBe(false)
    expect(isStablePythonVersion('1.0.dev2')).toBe(false)
    expect(isStablePythonVersion('2.0.30')).toBe(true)
    expect(isStablePythonVersion('2.0.post1')).toBe(true)
  })

  it('orders ordinary releases numerically', () => {
    expect(['2.9.0', '2.10.0', '2.8.0'].sort(comparePythonVersions).reverse()).toEqual([
      '2.10.0',
      '2.9.0',
      '2.8.0',
    ])
  })
})
