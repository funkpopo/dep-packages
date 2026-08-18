import pLimit from 'p-limit'
import { getPackageData } from '../api'
import type Item from './Item'

const limit = pLimit(5)

export async function getPackageDatas(dependencies: Item[], root: string, forceFresh = false) {
  const limited = dependencies.map(item => limit(() => getPackageData(item, root, forceFresh)))
  const datas = await Promise.all(limited)
  return datas
}
