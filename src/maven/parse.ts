import Item from '../core/Item'

const dependencyBlock = /<dependency(?:\s[^>]*)?>([\s\S]*?)<\/dependency\s*>/gi
const propertyReference = /^\$\{[^}]+\}$/

function maskComments(text: string) {
  return text.replace(/<!--[\s\S]*?-->/g, comment => comment.replace(/[^\r\n]/g, ' '))
}

function childValue(block: string, name: string) {
  const expression = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'i')
  const match = expression.exec(block)
  if (!match)
    return

  const leadingWhitespace = match[1].search(/\S/)
  if (leadingWhitespace < 0)
    return

  const value = match[1].trim()
  return {
    value,
    start: match.index + match[0].indexOf(match[1]) + leadingWhitespace,
  }
}

/** Parse dependencies with directly editable, explicit versions from a Maven POM. */
export function parsePom(text: string): Item[] {
  const source = maskComments(text)
  const items: Item[] = []

  for (const match of source.matchAll(dependencyBlock)) {
    const block = match[1]
    const groupId = childValue(block, 'groupId')
    const artifactId = childValue(block, 'artifactId')
    const version = childValue(block, 'version')
    if (!groupId || !artifactId || !version || propertyReference.test(version.value))
      continue

    const item = new Item()
    item.key = `${groupId.value}:${artifactId.value}`
    item.value = version.value
    item.start = (match.index ?? 0) + match[0].indexOf(block) + version.start
    item.end = item.start + version.value.length
    item.registry = 'maven'
    item.plainVersion = true
    items.push(item)
  }

  return items
}
