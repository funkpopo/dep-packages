import { describe, expect, it } from 'vitest'
import Item from '../src/core/Item'
import {
  COMPLETION_VERSION_LIMIT,
  HOVER_RECENT_VERSION_COUNT,
  normalizeVersions,
  orderHoverVersions,
  retainRelevantVersions,
  versionSatisfiesItem,
} from '../src/core/versions'

function npmItem(value = '^1.0.0') {
  return new Item({
    key: 'example',
    value,
    start: 0,
    end: value.length + 2,
    values: [],
    registry: 'npm',
    plainVersion: false,
    replacePrefix: '',
  })
}

describe('bounded version data', () => {
  it('filters invalid and prerelease versions, removes duplicates, and sorts newest first', () => {
    expect(normalizeVersions(npmItem(), [
      '1.0.0',
      '2.0.0-beta.1',
      'not-a-version',
      '2.0.0',
      '1.0.0',
    ])).toEqual(['2.0.0', '1.0.0'])
  })

  it('retains at most 100 versions including an older constraint match', () => {
    const recent = Array.from({ length: 150 }, (_, index) => `2.${149 - index}.0`)
    const normalized = normalizeVersions(npmItem(), [...recent, '1.9.0', '1.8.0'])
    const retained = retainRelevantVersions(npmItem(), normalized)

    expect(retained).toHaveLength(COMPLETION_VERSION_LIMIT)
    expect(retained[0]).toBe('2.149.0')
    expect(retained).toContain('1.9.0')
  })

  it('pins latest and highest matching versions before the scrollable history', () => {
    const versions = retainRelevantVersions(
      npmItem(),
      normalizeVersions(npmItem(), [
        ...Array.from({ length: 120 }, (_, index) => `2.${119 - index}.0`),
        '1.9.0',
      ]),
    )
    const hoverVersions = orderHoverVersions(npmItem(), versions)

    expect(hoverVersions[0]).toBe('2.119.0')
    expect(hoverVersions[1]).toBe('1.9.0')
    expect(hoverVersions.length).toBeLessThanOrEqual(COMPLETION_VERSION_LIMIT)
    expect(HOVER_RECENT_VERSION_COUNT).toBe(20)
  })

  it('uses Python stability rules before retaining versions', () => {
    const item = npmItem('>=2.0.0')
    item.registry = 'pypi'

    expect(normalizeVersions(item, ['2.0.0rc1', '2.0.0', '2.0.post1', '2.1.0.dev1']))
      .toEqual(['2.0.post1', '2.0.0'])
  })

  it('retains and pins an older PEP 440 compatible-release match', () => {
    const item = npmItem('~=1.4')
    item.registry = 'pypi'
    const normalized = normalizeVersions(item, [
      ...Array.from({ length: 120 }, (_, index) => `2.${119 - index}.0`),
      '1.9.0',
      '1.8.0',
    ])
    const retained = retainRelevantVersions(item, normalized)
    const hoverVersions = orderHoverVersions(item, retained)

    expect(retained).toHaveLength(COMPLETION_VERSION_LIMIT)
    expect(hoverVersions.slice(0, 2)).toEqual(['2.119.0', '1.9.0'])
    expect(versionSatisfiesItem(item, '1.9.0')).toBe(true)
    expect(versionSatisfiesItem(item, '2.0.0')).toBe(false)
  })
})
