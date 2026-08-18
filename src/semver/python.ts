import { valid } from 'semver'
import compareVersions from './compareVersion'

/** Exclude PEP 440 alpha, beta, release-candidate, and development releases. */
export function isStablePythonVersion(version: string) {
  return !/(?:a|b|rc|alpha|beta|pre|preview|dev)(?:[.-]?\d+)?(?=$|[.+-])/i.test(version)
}

export function comparePythonVersions(first: string, second: string) {
  if (valid(first) && valid(second))
    return compareVersions(first, second)
  return first.localeCompare(second, undefined, { numeric: true })
}
