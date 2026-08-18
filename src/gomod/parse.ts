import Item from '../core/Item'

const requireLine = /^\s*([^\s]+)\s+(v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)(?:\s*\/\/.*)?\s*$/

function parseRequireLine(line: string, lineStart: number): Item | undefined {
  const match = line.match(requireLine)
  if (!match)
    return

  const [, modulePath, version] = match
  const item = new Item()
  item.key = modulePath
  item.value = version
  item.start = lineStart + line.indexOf(version)
  item.end = item.start + version.length
  item.registry = 'go'
  item.plainVersion = true
  return item
}

/** Parse versioned module requirements from a go.mod file. */
export function parseGoMod(text: string): Item[] {
  const items: Item[] = []
  const lineParts = text.split(/(\r\n|\n|\r)/)
  let lineStart = 0
  let inRequireBlock = false

  for (let index = 0; index < lineParts.length; index += 2) {
    const line = lineParts[index]
    const newline = lineParts[index + 1] ?? ''
    const trimmed = line.trim()

    if (inRequireBlock) {
      if (trimmed === ')') {
        inRequireBlock = false
      }
      else {
        const item = parseRequireLine(line, lineStart)
        if (item)
          items.push(item)
      }
    }
    else if (/^require\s*\(\s*(?:\/\/.*)?$/.test(trimmed)) {
      inRequireBlock = true
    }
    else {
      const singleRequire = line.match(/^\s*require\s+(.+)$/)
      if (singleRequire) {
        const requirementStart = line.indexOf(singleRequire[1])
        const item = parseRequireLine(singleRequire[1], lineStart + requirementStart)
        if (item)
          items.push(item)
      }
    }

    lineStart += line.length + newline.length
  }

  return items
}
