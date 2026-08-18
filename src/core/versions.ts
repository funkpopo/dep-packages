import compareVersions from '../semver/compareVersion'
import { comparePythonVersions, isStablePythonVersion } from '../semver/python'
import { checkVersion } from '../semver/utils'
import type Item from './Item'

export const COMPLETION_VERSION_LIMIT = 100
export const HOVER_RECENT_VERSION_COUNT = 20

function pythonUpperBound(version: string, keepSegments: number): string | undefined {
  const segments = version.match(/^\d+(?:\.\d+)*/)?.[0].split('.').map(Number)
  if (!segments?.length)
    return
  const index = Math.min(keepSegments, segments.length) - 1
  segments[index] += 1
  return segments.slice(0, index + 1).join('.')
}

function satisfiesPythonComparator(version: string, operator: string, target: string): boolean {
  const comparison = comparePythonVersions(version, target)
  if (operator === '=')
    return target.endsWith('.*') ? version.startsWith(target.slice(0, -1)) : comparison === 0
  if (operator === '!=')
    return comparison !== 0
  if (operator === '>')
    return comparison > 0
  if (operator === '>=')
    return comparison >= 0
  if (operator === '<')
    return comparison < 0
  if (operator === '<=')
    return comparison <= 0

  const releaseSegments = target.match(/^\d+(?:\.\d+)*/)?.[0].split('.').length ?? 1
  const compatibleOperator = operator || '^'
  const upperBound = compatibleOperator === '~='
    ? pythonUpperBound(target, Math.max(1, releaseSegments - 1))
    : compatibleOperator === '~'
      ? pythonUpperBound(target, Math.min(2, releaseSegments))
      : pythonUpperBound(target, target.startsWith('0.') ? Math.min(2, releaseSegments) : 1)

  return comparison >= 0 && Boolean(upperBound) && comparePythonVersions(version, upperBound!) < 0
}

export function versionSatisfiesItem(item: Item, version: string): boolean {
  const constraint = item.value === 'latest' ? '*' : item.value
  if (item.registry !== 'pypi')
    return checkVersion(constraint, [version])[0]
  if (constraint === '*' || constraint.trim() === '')
    return true

  const comparators = [...constraint.matchAll(/(!=|~=|>=|<=|>|<|=|\^|~)?\s*([^\s]+)/g)]
  return comparators.length > 0 && comparators.every(([, operator = '', target]) =>
    satisfiesPythonComparator(version, operator, target),
  )
}

export function getMaxSatisfyingVersion(item: Item, versions: string[]): string | null {
  if (item.registry !== 'pypi')
    return checkVersion(item.value === 'latest' ? '*' : item.value, versions)[1]
  return versions.find(version => versionSatisfiesItem(item, version)) ?? null
}

/** Remove unusable releases early and put the newest stable release first. */
export function normalizeVersions(item: Item, versions: string[]): string[] {
  const stableVersions = versions.filter(version => item.registry === 'pypi'
    ? isStablePythonVersion(version)
    : compareVersions.validate(version) && !version.includes('-'))

  return [...new Set(stableVersions)]
    .sort(item.registry === 'pypi' ? comparePythonVersions : compareVersions)
    .reverse()
}

/**
 * Bound document/completion data while retaining the version that best
 * satisfies the declaration, even when it is older than the recent window.
 */
export function retainRelevantVersions(
  item: Item,
  versions: string[],
  limit = COMPLETION_VERSION_LIMIT,
): string[] {
  if (limit <= 0)
    return []
  if (versions.length <= limit)
    return versions

  const maxSatisfying = getMaxSatisfyingVersion(item, versions)
  const retained = versions.slice(0, limit)
  if (!maxSatisfying || retained.includes(maxSatisfying))
    return retained

  retained[retained.length - 1] = maxSatisfying
  return retained
}

/** Pin important versions at the top; VS Code scrolls through the remainder. */
export function orderHoverVersions(item: Item, versions: string[]): string[] {
  const maxSatisfying = getMaxSatisfyingVersion(item, versions)
  const pinned = [versions[0], maxSatisfying].filter((version): version is string => Boolean(version))
  return [...new Set([...pinned, ...versions])]
}
