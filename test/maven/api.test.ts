import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mavenVersions } from '../../src/api/maven'

const mocks = vi.hoisted(() => ({ ofetch: vi.fn() }))

vi.mock('ofetch', () => ({ ofetch: mocks.ofetch }))

describe('maven Central API', () => {
  beforeEach(() => mocks.ofetch.mockReset())

  it('queries by group and artifact and returns document versions', async () => {
    mocks.ofetch.mockResolvedValue({
      response: { docs: [{ v: '2.4.10' }, { v: '2.4.9' }] },
    })

    await expect(mavenVersions('io.milvus:milvus-sdk-java')).resolves.toEqual(['2.4.10', '2.4.9'])
    expect(mocks.ofetch).toHaveBeenCalledWith(
      'https://search.maven.org/solrsearch/select',
      expect.objectContaining({
        query: expect.objectContaining({
          q: 'g:"io.milvus" AND a:"milvus-sdk-java"',
          core: 'gav',
        }),
      }),
    )
  })

  it('rejects malformed coordinates without making a request', async () => {
    await expect(mavenVersions('missing-artifact')).resolves.toBeNull()
    await expect(mavenVersions('org.example:bad artifact')).resolves.toBeNull()
    expect(mocks.ofetch).not.toHaveBeenCalled()
  })
})
