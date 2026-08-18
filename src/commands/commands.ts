import type { TextEditor, TextEditorEdit } from 'vscode'
import { Range, commands } from 'vscode'
import jsonListener from '../core/listener'
import { freshChecker } from '../api'

export interface ReplaceItem {
  item: string
  start: number
  end: number
  plain?: boolean
}

export const status = {
  inProgress: false,
  replaceItems: [] as ReplaceItem[],
}

export const replaceVersion = commands.registerTextEditorCommand(
  'depdetect.replaceVersion',
  (editor: TextEditor, edit: TextEditorEdit, info: ReplaceItem) => {
    if (editor && info && !status.inProgress) {
      const { fileName } = editor.document
      if (
        fileName.toLocaleLowerCase().endsWith('package.json')
        || fileName.toLocaleLowerCase().endsWith('requirements.txt')
        || fileName.toLocaleLowerCase().endsWith('pyproject.toml')
      ) {
        status.inProgress = true
        console.log('Replacing', info.item)
        const start = info.plain ? info.start : info.start + 1
        const end = info.plain ? info.end : info.end - 1
        const value = info.plain ? info.item : info.item.substr(1, info.item.length - 2)
        edit.replace(new Range(editor.document.positionAt(start), editor.document.positionAt(end)), value)

        status.inProgress = false
      }
    }
  },
)

export const reload = commands.registerTextEditorCommand(
  'depdetect.retry',
  (editor: TextEditor) => {
    freshChecker.set(true)
    if (editor)
      void jsonListener(editor, { forceFetch: true })
  },
)

export const updateAll = commands.registerTextEditorCommand(
  'depdetect.updateAll',
  (editor: TextEditor, edit: TextEditorEdit) => {
    if (
      editor
      && !status.inProgress
      && status.replaceItems
      && status.replaceItems.length > 0
      && editor.document.fileName.toLocaleLowerCase().endsWith('package.json')
    ) {
      status.inProgress = true
      console.log('Replacing All')
      for (let i = status.replaceItems.length - 1; i > -1; i--) {
        const rItem = status.replaceItems[i]
        edit.replace(
          new Range(
            editor.document.positionAt(rItem.start),
            editor.document.positionAt(rItem.end),
          ),
          rItem.item,
        )
      }
      status.inProgress = false
      // Sometimes fails at the first time.
      editor.document.save().then(a => {
        if (!a)
          editor.document.save()
      })
    }
  },
)

export default { replaceVersion, reload, updateAll }
