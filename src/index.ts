import type { ExtensionContext } from 'vscode'
import Commands from './commands/commands'
import { registerAutoCompletion } from './providers/autoCompletion'
import { registerListener } from './core/listener'
import { saveCache } from './api'
import { initializeDecoration } from './ui/decorator'

export function activate(context: ExtensionContext) {
  initializeDecoration(context)
  registerListener(context)
  registerAutoCompletion(context)
  context.subscriptions.push(
    Commands.replaceVersion,
    Commands.reload,
  )
}

export function deactivate() {
  saveCache()
}
