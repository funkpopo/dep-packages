import type Item from '../core/Item'
import { createPyPiItem, parseRequirementFragment } from '../requirements/parse'

const quotedValue = /(["'])(.*?)\1/g
const poetrySection = /^tool\.poetry(?:\.group\.[^.]+)?\.dependencies$/
const arraySections = new Set([
  'project',
  'project.optional-dependencies',
  'dependency-groups',
  'build-system',
])

function isDependencyArray(section: string, key: string) {
  if (section === 'project')
    return key === 'dependencies'
  if (section === 'build-system')
    return key === 'requires'
  return section === 'project.optional-dependencies' || section === 'dependency-groups'
}

function parsePoetryDependency(line: string, lineStart: number): Item | undefined {
  const assignment = line.match(/^\s*["']?([A-Za-z0-9][A-Za-z0-9._-]*)["']?\s*=\s*(.*)$/)
  if (!assignment || assignment[1].toLowerCase() === 'python')
    return

  const name = assignment[1]
  const valueText = assignment[2]
  const valueTextStart = line.indexOf(valueText)
  const direct = valueText.match(/^(["'])(.*?)\1/)
  const inline = valueText.match(/\bversion\s*=\s*(["'])(.*?)\1/)
  const selected = direct ?? inline
  if (!selected)
    return

  const constraint = selected[2]
  if (!constraint || constraint === '*')
    return

  const constraintOffset = valueText.indexOf(selected[0]) + selected[0].indexOf(constraint)
  const operatorMatch = constraint.match(/^(===|==|~=|!=|<=|>=|\^|~|<|>|=)/)
  const operator = operatorMatch?.[0] ?? ''
  const rawVersion = constraint.slice(operator.length)
  if (!rawVersion)
    return

  return createPyPiItem(
    name,
    operator,
    rawVersion,
    lineStart + valueTextStart + constraintOffset + operator.length,
  )
}

export function parsePyProject(text: string): Item[] {
  const items: Item[] = []
  const lineParts = text.split(/(\r\n|\n|\r)/)
  let lineStart = 0
  let section = ''
  let dependencyArray = false

  for (let index = 0; index < lineParts.length; index += 2) {
    const line = lineParts[index]
    const newline = lineParts[index + 1] ?? ''
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]/)
    if (sectionMatch) {
      section = sectionMatch[1].trim()
      dependencyArray = false
      lineStart += line.length + newline.length
      continue
    }

    if (poetrySection.test(section)) {
      const item = parsePoetryDependency(line, lineStart)
      if (item)
        items.push(item)
    }
    else if (arraySections.has(section)) {
      if (!dependencyArray) {
        const assignment = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*\[/)
        if (assignment && isDependencyArray(section, assignment[1]))
          dependencyArray = true
      }

      if (dependencyArray) {
        quotedValue.lastIndex = 0
        for (const match of line.matchAll(quotedValue)) {
          const fragment = match[2]
          const fragmentStart = lineStart + (match.index ?? 0) + match[0].indexOf(fragment)
          const item = parseRequirementFragment(fragment, fragmentStart)
          if (item)
            items.push(item)
        }
        if (/\]\s*(?:#.*)?$/.test(line))
          dependencyArray = false
      }
    }

    lineStart += line.length + newline.length
  }

  return items
}
