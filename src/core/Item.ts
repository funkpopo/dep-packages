/**
 * Item is a data structure to define parsed items, hierarchy and index.
 */
export default class Item {
  key = ''
  values: Array<any> = []
  value = ''
  start = -1
  end = -1
  registry: 'npm' | 'pypi' = 'npm'
  /** Requirements files do not wrap versions in JSON quotes. */
  plainVersion = false
  /** Preserve the leading Python requirement operator when replacing a version. */
  replacePrefix = ''
  constructor(item?: Item) {
    if (item) {
      this.key = item.key
      this.values = item.values
      this.value = item.value
      this.start = item.start
      this.end = item.end
      this.registry = item.registry
      this.plainVersion = item.plainVersion
      this.replacePrefix = item.replacePrefix
    }
  }
}
