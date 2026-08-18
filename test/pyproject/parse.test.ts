import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsePyProject } from '../../src/pyproject/parse'

describe('pyproject parser', () => {
  it('parses PEP 621 core and optional dependencies with exact offsets', () => {
    const source = readFileSync(new URL('./fixture.toml', import.meta.url), 'utf8')
    const items = parsePyProject(source)

    expect(items.map(item => item.key)).toEqual([
      'requests',
      'pydantic',
      'httpx',
      'python-dotenv',
      'pytest',
      'pytest-cov',
      'ruff',
      'mypy',
      'pre-commit',
      'mkdocs',
      'mkdocs-material',
    ])
    expect(items.map(item => source.slice(item.start, item.end))).toEqual([
      '2.31.0',
      '2.7.0',
      '0.27.0',
      '1.0.0',
      '8.0.0',
      '5.0.0',
      '0.4.0',
      '1.10.0',
      '3.7.0',
      '1.6.0',
      '9.5.0',
    ])
  })

  it('parses Poetry string and inline-table dependencies with CRLF offsets', () => {
    const source = `[tool.poetry.dependencies]\r\npython = "^3.11"\r\nrequests = "^2.31.0"\r\nDjango = { version = ">=5.0", extras = ["argon2"] }\r\n\r\n[tool.poetry.group.dev.dependencies]\r\npytest = "8.2.2"\r\n`
    const items = parsePyProject(source)

    expect(items.map(item => [item.key, item.value])).toEqual([
      ['requests', '^2.31.0'],
      ['django', '>=5.0'],
      ['pytest', '8.2.2'],
    ])
    expect(items.map(item => source.slice(item.start, item.end))).toEqual([
      '2.31.0',
      '5.0',
      '8.2.2',
    ])
  })

  it('replaces PEP 621 and Poetry versions without duplicating constraints', () => {
    const pepSource = `\n[project]\ndependencies = [\n  "requests>=2.31.0",\n]\n`
    const pepItem = parsePyProject(pepSource)[0]
    const updatedPep = `${pepSource.slice(0, pepItem.start)}9.9.9${pepSource.slice(pepItem.end)}`
    expect(updatedPep).toContain('"requests>=9.9.9"')

    const poetrySource = `\n[tool.poetry.dependencies]\nrequests = "^2.31.0"\n`
    const poetryItem = parsePyProject(poetrySource)[0]
    const updatedPoetry = `${poetrySource.slice(0, poetryItem.start)}9.9.9${poetrySource.slice(poetryItem.end)}`
    expect(updatedPoetry).toContain('requests = "^9.9.9"')
  })
})
