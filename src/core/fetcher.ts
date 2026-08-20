import { CompletionItem, CompletionItemKind, CompletionList } from 'vscode'
import { sortText } from '../providers/autoCompletion'
import { statusBarItem } from '../ui/indicators'
import type { PackageData } from '../api'
import type Item from './Item'
import type Dependency from './Dependency'
import { getPackageDatas } from './worker'
import { normalizeVersions, retainRelevantVersions } from './versions'

export async function fetchPackageVersions(
  dependencies: Item[],
  root: string,
  forceFresh = false,
): Promise<[Dependency[], Map<string, Dependency[]>]> {
  statusBarItem.setText('👀 Fetching registry')

  const responsesMap: Map<string, Dependency[]> = new Map()

  const packageData = await fetchPackageData(dependencies, root, forceFresh)

  const responses = dependencies.map(
    (item, index) => {
      try {
        const data = packageData[index]
        if (!data)
          throw new Error('Get Package information failure')

        const versions = retainRelevantVersions(item, normalizeVersions(item, data.version))
        let i = 0
        const versionCompletionItems = new CompletionList(
          versions.map(version => {
            const completionItem = new CompletionItem(
              version,
              CompletionItemKind.Class,
            )
            completionItem.preselect = i === 0
            completionItem.sortText = sortText(i++)
            return completionItem
          }),
          true,
        )
        const dependency = {
          item,
          versions,
          info: data.info,
          versionCompletionItems,
        }
        const found = responsesMap.get(item.key)
        if (found)
          found.push(dependency)

        else
          responsesMap.set(item.key, [dependency])
        return dependency
      }
      catch (error) {
        console.error(error)
        return {
          item,
          error: `${item.key}: ${error}`,
        }
      }
    },
  )

  return [responses, responsesMap]
}

async function fetchPackageData(
  dependencies: Item[],
  root: string,
  forceFresh: boolean,
): Promise<PackageData[]> {
  const packageDatas = await getPackageDatas(
    dependencies,
    root,
    forceFresh,
  )

  return packageDatas
}
