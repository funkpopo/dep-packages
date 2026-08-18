import { describe, expect, it } from 'vitest'
import { escapeGoModulePath } from '../../src/api/gomod'

describe('go module proxy API', () => {
  it('escapes uppercase letters and exclamation marks per the proxy protocol', () => {
    expect(escapeGoModulePath('github.com/Azure/go-ntlmssp')).toBe('github.com/!azure/go-ntlmssp')
    expect(escapeGoModulePath('example.com/Hello!World')).toBe('example.com/!hello!!!world')
  })
})
