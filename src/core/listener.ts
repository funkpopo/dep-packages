/* eslint-disable import/no-mutable-exports */
import type { ExtensionContext, Position, TextDocument, TextEditor } from 'vscode'
import { Range, window, workspace } from 'vscode'

import decorate, { decorationHandle } from '../ui/decorator'
import { parseJson } from '../json/parse'
import { parseRequirements } from '../requirements/parse'
import { parsePyProject } from '../pyproject/parse'
import { status } from '../commands/commands'
import { statusBarItem } from '../ui/indicators'
import type Dependency from './Dependency'
import type Item from './Item'
import { fetchPackageVersions } from './fetcher'

function parseDeps(document: TextDocument): Item[] {
  if (isRequirements(document))
    return parseRequirements(document.getText())
  if (isPyProject(document))
    return parsePyProject(document.getText())
  return parseJson(document.getText())
}

let dependencies: Item[]
let fetchedDeps: Dependency[]
let fetchedDepsMap: Map<string, Dependency[]>
export { dependencies, fetchedDeps, fetchedDepsMap }

export interface ListenerOptions {
  /** Fetch package metadata when this editor is first loaded. */
  fetch?: boolean
  /** Ignore the document state and fetch fresh package metadata. */
  forceFetch?: boolean
}

interface DocumentState {
  fetched: Dependency[]
}

/**
 * Keep the fetched data associated with the document that produced it. The
 * extension used to keep only one global result, which made every save look
 * like a reason to fetch the whole file again.
 */
const documentStates = new Map<string, DocumentState>()
const pendingDocumentFetches = new Map<string, Promise<DocumentState>>()

function documentKey(document: TextDocument) {
  return document.uri.toString()
}

function createDocumentState(fetched: Dependency[]): DocumentState {
  return { fetched }
}

function rebindDependencies(items: Item[], fetched: Dependency[]) {
  const fetchedByKey = new Map<string, Dependency[]>()
  for (const dependency of fetched) {
    const sameKey = fetchedByKey.get(dependency.item.key)
    if (sameKey)
      sameKey.push(dependency)
    else
      fetchedByKey.set(dependency.item.key, [dependency])
  }

  const occurrences = new Map<string, number>()
  return items.map(item => {
    const occurrence = occurrences.get(item.key) ?? 0
    occurrences.set(item.key, occurrence + 1)

    const previous = fetchedByKey.get(item.key)?.[occurrence]
    return previous ? { ...previous, item } : { item }
  })
}

function getFetchedMap(fetched: Dependency[]) {
  const result = new Map<string, Dependency[]>()
  for (const dependency of fetched) {
    const sameKey = result.get(dependency.item.key)
    if (sameKey)
      sameKey.push(dependency)
    else
      result.set(dependency.item.key, [dependency])
  }
  return result
}

function fetchDocumentState(
  editor: TextEditor,
  items: Item[],
  forceFresh: boolean,
) {
  const key = documentKey(editor.document)
  const pending = pendingDocumentFetches.get(key)
  if (pending)
    return pending

  const request = fetchPackageVersions(items, forceFresh)
    .then(([fetched]) => {
      const state = createDocumentState(fetched)
      documentStates.set(key, state)
      return state
    })
    .finally(() => {
      if (pendingDocumentFetches.get(key) === request)
        pendingDocumentFetches.delete(key)
    })

  pendingDocumentFetches.set(key, request)
  return request
}

function hasDocumentState(editor: TextEditor) {
  const key = documentKey(editor.document)
  return documentStates.has(key) || pendingDocumentFetches.has(key)
}

export function getFetchedDependency(document: TextDocument, dep: string, position: Position): Dependency | undefined {
  if (!fetchedDepsMap)
    return

  const fetchedDep = fetchedDepsMap.get(dep)
  if (!fetchedDep)
    return
  if (fetchedDep.length === 1) {
    return fetchedDep[0]
  }
  else {
    for (let i = 0; i < fetchedDep.length; i++) {
      const range = new Range(
        document.positionAt(fetchedDep[i].item.start + 1),
        document.positionAt(fetchedDep[i].item.end),
      )
      if (range.contains(position))
        return fetchedDep[i]
    }
  }
}

export async function parseAndDecorate(
  editor: TextEditor,
  _wasSaved = false,
  fetchDeps = true,
  forceFresh = false,
) {
  const text = editor.document.getText()
  // const config = workspace.getConfiguration('', editor.document.uri)

  try {
    const parsedDependencies = parseDeps(editor.document)
    const key = documentKey(editor.document)
    let state: DocumentState | undefined

    if (fetchDeps) {
      state = await fetchDocumentState(editor, parsedDependencies, forceFresh)
    }
    else {
      state = documentStates.get(key)
      if (!state) {
        const pending = pendingDocumentFetches.get(key)
        if (pending)
          state = await pending
      }
    }

    // The document may have changed while package metadata was being
    // fetched. Re-read it so offsets and the visible decorations belong to
    // the current document version.
    const currentDependencies = parseDeps(editor.document)
    const currentFetched = rebindDependencies(currentDependencies, state?.fetched ?? [])
    dependencies = currentDependencies
    fetchedDeps = currentFetched
    fetchedDepsMap = getFetchedMap(currentFetched)
    decorate(editor, currentFetched)
  }
  catch (e) {
    console.error(e)
    statusBarItem.setText('Dependency file is not valid!')
    if (decorationHandle)
      decorationHandle.dispose()
  }
}

function isPackageJson(document: TextDocument) {
  return document.fileName.toLocaleLowerCase().endsWith('package.json')
}

function isRequirements(document: TextDocument) {
  return document.fileName.toLocaleLowerCase().endsWith('requirements.txt')
}

function isPyProject(document: TextDocument) {
  return document.fileName.toLocaleLowerCase().endsWith('pyproject.toml')
}

function isDependencyFile(document: TextDocument) {
  return isPackageJson(document) || isRequirements(document) || isPyProject(document)
}

function isDiffEditor(editor: TextEditor | undefined) {
  if (!editor)
    return false

  // Git-based diff sides can have a non-file URI. The modified side can
  // still use the normal file URI, so also inspect the active tab input when
  // that VS Code API is available.
  if (['git', 'gitlens', 'scm', 'vscode-scm'].includes(editor.document.uri.scheme))
    return true

  const tabGroups = (window as typeof window & {
    tabGroups?: {
      activeTabGroup?: {
        activeTab?: { input?: unknown }
      }
    }
  }).tabGroups
  const input = tabGroups?.activeTabGroup?.activeTab?.input
  return typeof input === 'object'
    && input !== null
    && 'original' in input
    && 'modified' in input
}

export default async function listener(
  editor: TextEditor | undefined,
  options: ListenerOptions = {},
) {
  if (editor) {
    if (isDependencyFile(editor.document)) {
      status.inProgress = true
      status.replaceItems = []
      statusBarItem.show()

      // Loading a document is the only automatic network operation. Changes
      // and saves use the already fetched versions and only update positions.
      const shouldFetch = options.forceFetch === true
        || (options.fetch !== false && !hasDocumentState(editor))

      try {
        await parseAndDecorate(editor, false, shouldFetch, options.forceFetch === true)
      }
      finally {
        status.inProgress = false
      }
    }
    else {
      statusBarItem.hide()
    }
  }
  else {
    console.log('No active edtior found.')
  }

  return Promise.resolve()
}

let throttleId: NodeJS.Timeout | undefined

export function throttledListener(
  editor: TextEditor | undefined,
  timeout = 0,
  options: ListenerOptions = {},
) {
  if (throttleId)
    clearTimeout(throttleId)
  throttleId = setTimeout(() => {
    void listener(editor, options)
    throttleId = undefined
  }, timeout)
}

export function registerListener(context: ExtensionContext) {
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(editor => {
      void listener(editor, isDiffEditor(editor) ? { fetch: false } : {})
    }),
    workspace.onDidChangeTextDocument(e => {
      const editor = window.activeTextEditor
      if (editor && editor.document.uri.toString() === e.document.uri.toString() && isDependencyFile(e.document))
        throttledListener(editor, 100, { fetch: false })
    }),
    workspace.onDidSaveTextDocument(document => {
      const editor = window.activeTextEditor
      if (editor && editor.document.uri.toString() === document.uri.toString() && isDependencyFile(document))
        throttledListener(editor, 100, { fetch: false })
    }),
    // When activation is triggered while VS Code is restoring the workbench,
    // activeTextEditor can briefly be undefined and no active-editor event is
    // guaranteed afterwards. Visible editors provide a second, reliable
    // activation path for an already-open package.json.
    window.onDidChangeVisibleTextEditors(editors => {
      for (const editor of editors) {
        if (isDependencyFile(editor.document))
          void listener(editor, isDiffEditor(editor) ? { fetch: false } : {})
      }
    }),
  )

  const activeEditor = window.activeTextEditor
  void listener(activeEditor, isDiffEditor(activeEditor) ? { fetch: false } : {})

  // Defer one more check until the workbench has finished restoring editors.
  // This covers the extension being activated before package.json becomes the
  // active editor at startup.
  const startupRefresh = setTimeout(() => {
    const editor = window.activeTextEditor
    void listener(editor, isDiffEditor(editor) ? { fetch: false } : {})
  }, 0)
  context.subscriptions.push({ dispose: () => clearTimeout(startupRefresh) })
}
