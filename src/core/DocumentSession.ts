import type { TextDocument } from 'vscode'
import type Dependency from './Dependency'
import type Item from './Item'

export interface ReplaceItem {
  item: string
  start: number
  end: number
  plain?: boolean
}

export interface DocumentResultSummary {
  total: number
  fetched: number
  failed: number
}

/** All mutable UI state that belongs to one dependency document. */
export interface DocumentSession {
  dependencies: Item[]
  fetchedDeps: Dependency[]
  fetchedDepsMap: Map<string, Dependency[]>
  generation: number
  documentVersion?: number
  inProgress: boolean
  summary: DocumentResultSummary
}

export const documentSessions = new Map<string, DocumentSession>()

export function documentKey(document: TextDocument): string {
  return document.uri.toString()
}

export function createDocumentSession(document: TextDocument): DocumentSession {
  return {
    dependencies: [],
    fetchedDeps: [],
    fetchedDepsMap: new Map(),
    generation: 0,
    documentVersion: document.version,
    inProgress: false,
    summary: { total: 0, fetched: 0, failed: 0 },
  }
}

export function getDocumentSession(document: TextDocument): DocumentSession | undefined {
  return documentSessions.get(documentKey(document))
}

export function ensureDocumentSession(document: TextDocument): DocumentSession {
  const key = documentKey(document)
  let session = documentSessions.get(key)
  if (!session) {
    session = createDocumentSession(document)
    documentSessions.set(key, session)
  }
  return session
}

export function removeDocumentSession(document: TextDocument): void {
  documentSessions.delete(documentKey(document))
}
