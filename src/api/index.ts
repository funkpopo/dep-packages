import NodeCache from 'node-cache'
import type Item from '../core/Item'
import { ttl } from '../utils/ttl'
import { dumpCache, loadCache } from './cache'
import { version } from './version'
import { pypiVersions } from './pypi'
import { goModuleVersions } from './gomod'
import { mavenVersions } from './maven'
import { protocolDep } from './utils'

export const freshChecker = {
  needFresh: false,
  set(newVal: boolean) {
    this.needFresh = newVal
  },
}

const cacheInit = Object.entries(loadCache())
const init = cacheInit.map(([key, { cacheTime, data }]) => {
  return {
    key,
    val: data,
    ttl: ttl(cacheTime),
  }
})
const cache = new NodeCache({ stdTTL: 60 * 10 })
cache.mset(init)
// const cacheTTL = 30 * 60_000 // 30min

let cacheChanged = false
const pendingVersions = new Map<string, Promise<string[] | undefined>>()

export interface PackageData {
  version: string[]
  info?: string
}

export async function getPackageData(
  item: Item,
  root: string,
  forceFresh = freshChecker.needFresh,
): Promise<PackageData> {
  const preTest = protocolDep(item)
  if (preTest)
    return preTest

  const name = item.key
  const cacheKey = `${item.registry}:${name}`

  const cacheData: string[] | undefined = cache.get(cacheKey)
  if (cacheData && !forceFresh) {
    console.log('vscode-packages: use cache', name)
    return { version: cacheData }
  }

  const version = await reGetVersion(item, root)
  console.log('vscode-packages: fetch', name)

  return {
    version: version ?? cacheData ?? [],
  }
}

async function reGetVersion(item: Item, root: string): Promise<string[] | undefined> {
  const key = `${root}+++${item.registry}+++${item.key}`
  const pending = pendingVersions.get(key)
  if (pending)
    return pending

  const request = (async () => {
    try {
      const data = item.registry === 'pypi'
        ? await pypiVersions(item.key)
        : item.registry === 'go'
          ? await goModuleVersions(item.key)
          : item.registry === 'maven'
            ? await mavenVersions(item.key)
            : await version(item.key, root)

      if (data) {
        cache.set(`${item.registry}:${item.key}`, data)
        cacheChanged = true
        return data
      }
    }
    catch (e) {
      console.error(e)
    }

    return undefined
  })().finally(() => {
    if (pendingVersions.get(key) === request)
      pendingVersions.delete(key)
  })

  pendingVersions.set(key, request)
  return request
}

export function saveCache() {
  const cacheContent: any = cache.mget(cache.keys())
  dumpCache(cacheContent, cacheChanged)
}
