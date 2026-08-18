import { maxSatisfying, satisfies, valid, validRange } from 'semver'

export function checkVersion(version = '0.0.0', versions: string[]): [boolean, string | null] {
  let v = version
  const prefix = v.charCodeAt(0)
  if (prefix > 47 && prefix < 58)
    v = `^${v}`
  const validVersions = versions.filter(version => Boolean(valid(version)))
  const max = validVersions[0]
  if (!max || !validRange(v))
    return [false, null]
  return [satisfies(max, v), maxSatisfying(validVersions, v)]
}
