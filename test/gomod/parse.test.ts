import { describe, expect, it } from 'vitest'
import { parseGoMod } from '../../src/gomod/parse'

describe('go.mod parser', () => {
  const source = `module example.com/project

go 1.22

require example.com/direct v1.2.3

require (
\tgithub.com/example/one v0.9.0
\tgithub.com/example/two/v2 v2.3.4 // indirect
\tgithub.com/example/legacy v1.0.0+incompatible
)

replace github.com/example/one => ../one
replace github.com/example/two/v2 v2.3.4 => github.com/fork/two/v2 v2.3.5
`

  it('parses single and grouped requirements with exact version ranges', () => {
    const items = parseGoMod(source)

    expect(items.map(item => [item.key, item.value])).toEqual([
      ['example.com/direct', 'v1.2.3'],
      ['github.com/example/one', 'v0.9.0'],
      ['github.com/example/two/v2', 'v2.3.4'],
      ['github.com/example/legacy', 'v1.0.0+incompatible'],
    ])
    expect(items.map(item => source.slice(item.start, item.end))).toEqual([
      'v1.2.3',
      'v0.9.0',
      'v2.3.4',
      'v1.0.0+incompatible',
    ])
    expect(items.every(item => item.registry === 'go' && item.plainVersion)).toBe(true)
  })

  it('keeps exact offsets with CRLF line endings', () => {
    const windowsSource = source.replace(/\n/g, '\r\n')
    const items = parseGoMod(windowsSource)

    expect(items.map(item => windowsSource.slice(item.start, item.end))).toEqual([
      'v1.2.3',
      'v0.9.0',
      'v2.3.4',
      'v1.0.0+incompatible',
    ])
  })

  it('does not parse module, go, toolchain, exclude, or replace directives', () => {
    const items = parseGoMod(`module example.com/project
go 1.23.0
toolchain go1.24.1
exclude example.com/old v1.0.0
replace example.com/old v1.0.0 => example.com/new v1.1.0
`)
    expect(items).toEqual([])
  })
})
