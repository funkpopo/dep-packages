import type { TextDocument, TextEditor } from 'vscode'
import { workspace } from 'vscode'
import { dirname } from 'node:path'

export function getWorkspaceFolderPath(
  documentOrEditor?: TextDocument | TextEditor,
) {
  if (!documentOrEditor)
    return
  const document = isEditor(documentOrEditor)
    ? documentOrEditor.document
    : documentOrEditor
  return workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
}

function isEditor(
  documentOrEditor: TextDocument | TextEditor,
): documentOrEditor is TextEditor {
  return (documentOrEditor as any).document != null
}

/**
 * Resolve the project root for a specific dependency document.
 *
 * The document is deliberately the source of truth here. Looking at the
 * active editor would allow a user switching editors while a request is in
 * flight to change the cwd used by that request.
 */
export function getRoot(document: TextDocument): string {
  return getWorkspaceFolderPath(document) ?? dirname(document.uri.fsPath || document.fileName)
}
