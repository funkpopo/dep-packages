import type { TextEditor, TextEditorEdit } from 'vscode'
import { Range, commands } from 'vscode'
import jsonListener from '../core/listener'
import type { ReplaceItem } from '../core/DocumentSession'
import { getDocumentSession } from '../core/DocumentSession'

function isDependencyFile(fileName: string) {
  const normalized = fileName.toLocaleLowerCase()
  return normalized.endsWith('package.json')
    || normalized.endsWith('requirements.txt')
    || normalized.endsWith('pyproject.toml')
    || normalized.endsWith('go.mod')
    || /(?:^|[\\/])pom\.xml$/.test(normalized)
}

export const replaceVersion = commands.registerTextEditorCommand(
  'depdetect.replaceVersion',
  (editor: TextEditor, edit: TextEditorEdit, info: ReplaceItem) => {
    const session = editor && getDocumentSession(editor.document)
    if (editor && info && session && !session.inProgress) {
      const { fileName } = editor.document
      if (isDependencyFile(fileName)) {
        session.inProgress = true
        console.log('Replacing', info.item)
        const start = info.plain ? info.start : info.start + 1
        const end = info.plain ? info.end : info.end - 1
        const value = info.plain ? info.item : info.item.substr(1, info.item.length - 2)
        edit.replace(new Range(editor.document.positionAt(start), editor.document.positionAt(end)), value)

        session.inProgress = false
      }
    }
  },
)

export const reload = commands.registerTextEditorCommand(
  'depdetect.retry',
  (editor: TextEditor) => {
    if (editor)
      void jsonListener(editor, { forceFresh: true })
  },
)

export const updateAll = commands.registerTextEditorCommand(
  'depdetect.updateAll',
  (editor: TextEditor, edit: TextEditorEdit) => {
    const session = editor && getDocumentSession(editor.document)
    if (
      editor
      && session
      && !session.inProgress
      && session.replaceItems.length > 0
      && isDependencyFile(editor.document.fileName)
    ) {
      session.inProgress = true
      console.log('Replacing All')
      for (let i = session.replaceItems.length - 1; i > -1; i--) {
        const rItem = session.replaceItems[i]
        edit.replace(
          new Range(
            editor.document.positionAt(rItem.start),
            editor.document.positionAt(rItem.end),
          ),
          rItem.item,
        )
      }
      session.inProgress = false
      // Sometimes fails at the first time.
      editor.document.save().then(a => {
        if (!a)
          editor.document.save()
      })
    }
  },
)

export default { replaceVersion, reload, updateAll }
