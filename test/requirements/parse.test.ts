import { describe, expect, it } from 'vitest'
import { parseRequirements } from '../../src/requirements/parse'

describe('requirements parser', () => {
  const source = `# Runtime dependencies
requests==2.31.0
Django~=4.2
urllib3>=1.26,<3
Flask[async]>=2.3
-r common.txt
-e git+https://github.com/example/project.git
local @ file:../local
`

  it('parses PyPI package names, version constraints, and exact source ranges', () => {
    const items = parseRequirements(source)

    expect(items.map(item => [item.key, item.value])).toEqual([
      ['requests', '=2.31.0'],
      ['django', '~=4.2'],
      ['urllib3', '>=1.26 <3'],
      ['flask', '>=2.3'],
    ])
    expect(source.slice(items[0].start, items[0].end)).toBe('2.31.0')
    expect(items.every(item => item.registry === 'pypi' && item.plainVersion)).toBe(true)
  })

  it('keeps exact offsets with Windows CRLF line endings', () => {
    const windowsSource = source.replace(/\n/g, '\r\n')
    const items = parseRequirements(windowsSource)

    expect(items.map(item => windowsSource.slice(item.start, item.end))).toEqual([
      '2.31.0',
      '4.2',
      '1.26,<3',
      '2.3',
    ])
  })

  it('replaces only version text and preserves the existing operator once', () => {
    const items = parseRequirements(source)
    const item = items[0]
    const updated = `${source.slice(0, item.start)}9.9.9${source.slice(item.end)}`

    expect(updated).toContain('requests==9.9.9')
    expect(updated).not.toContain('requests====9.9.9')
  })
})
