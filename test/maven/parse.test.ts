import { describe, expect, it } from 'vitest'
import { parsePom } from '../../src/maven/parse'

describe('pom.xml parser', () => {
  const source = `<project>
  <dependencies>
    <dependency>
      <groupId>io.milvus</groupId>
      <artifactId>milvus-sdk-java</artifactId>
      <version>2.4.10</version>
    </dependency>
    <dependency>
      <groupId>org.example</groupId>
      <artifactId>managed</artifactId>
      <version>\${managed.version}</version>
    </dependency>
    <!--
    <dependency>
      <groupId>org.example</groupId>
      <artifactId>commented</artifactId>
      <version>9.9.9</version>
    </dependency>
    -->
  </dependencies>
</project>
`

  it('parses explicit dependency versions and preserves their exact offsets', () => {
    const items = parsePom(source)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      key: 'io.milvus:milvus-sdk-java',
      value: '2.4.10',
      registry: 'maven',
      plainVersion: true,
    })
    expect(source.slice(items[0].start, items[0].end)).toBe('2.4.10')
  })

  it('keeps exact offsets with CRLF line endings', () => {
    const windowsSource = source.replace(/\n/g, '\r\n')
    const [item] = parsePom(windowsSource)
    expect(windowsSource.slice(item.start, item.end)).toBe('2.4.10')
  })

  it('parses versions inside dependencyManagement', () => {
    const managed = `<dependencyManagement><dependencies><dependency>
      <groupId>org.example</groupId><artifactId>library</artifactId><version>1.2.3</version>
    </dependency></dependencies></dependencyManagement>`
    expect(parsePom(managed).map(item => [item.key, item.value])).toEqual([
      ['org.example:library', '1.2.3'],
    ])
  })
})
