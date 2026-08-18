import Item from '../core/Item'

// PEP 508 names can contain letters, digits, dots, underscores, and hyphens.
// Extras are deliberately ignored for lookup: `requests[socks]` is published
// on PyPI as `requests`.
const requirement = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*(===|==|~=|!=|<=|>=|<|>)\s*([^\s;#,]+(?:\s*,\s*(?:!=|<=|>=|<|>)\s*[^\s;#,]+)*)/

export function createPyPiItem(
  name: string,
  operator: string,
  rawVersion: string,
  versionStart: number,
) {
  const item = new Item()
  item.key = name.toLowerCase().replace(/[_.-]+/g, '-')
  // semver understands `=` rather than Python's `==`, and space-separated
  // comparator sets rather than comma-separated PEP 440 sets.
  item.value = `${operator === '==' ? '=' : operator}${rawVersion}`.replace(/,/g, ' ')
  item.start = versionStart
  item.end = versionStart + rawVersion.length
  item.registry = 'pypi'
  item.plainVersion = true
  item.replacePrefix = operator
  return item
}

/** Parse one PEP 508 requirement fragment at its absolute document offset. */
export function parseRequirementFragment(fragment: string, absoluteStart: number) {
  const match = fragment.match(requirement)
  if (!match)
    return

  const [, name, operator, rawVersion] = match
  const valueOffset = (match.index ?? 0) + match[0].indexOf(rawVersion)
  return createPyPiItem(name, operator, rawVersion, absoluteStart + valueOffset)
}

export function parseRequirements(text: string): Item[] {
  const items: Item[] = []
  let lineStart = 0
  // Keep separators in the split result so offsets remain exact for LF,
  // Windows CRLF, and old-style CR documents.
  const lineParts = text.split(/(\r\n|\n|\r)/)

  for (let index = 0; index < lineParts.length; index += 2) {
    const line = lineParts[index]
    const newline = lineParts[index + 1] ?? ''
    const item = parseRequirementFragment(line, lineStart)
    if (item)
      items.push(item)
    lineStart += line.length + newline.length
  }

  return items
}
