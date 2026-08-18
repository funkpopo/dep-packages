/* eslint-disable no-template-curly-in-string */
/**
 * Helps to manage decorations for the TOML files.
 */
import type {
  DecorationOptions,
  TextEditor,
} from 'vscode'
import {
  MarkdownString,
  Range,
  window,
} from 'vscode'
import { validRange } from 'semver'
import { checkVersion } from '../semver/utils'
import type Item from '../core/Item'
import type { ReplaceItem } from '../core/DocumentSession'
import { prefixs } from '../constants'

export function latestVersion() {
  return window.createTextEditorDecorationType({
    after: {
      margin: '2em',
    },
  })
}

export default function decoration(
  editor: TextEditor,
  item: Item,
  versions: string[],
  compatibleDecorator: string,
  incompatibleDecorator: string,
  errorDecorator: string,
  error?: string,
  info?: string,
  markerColumn?: number,
  replaceItems?: ReplaceItem[],
): DecorationOptions {
  // Also handle json valued dependencies

  const start = item.start
  const line = editor.document.lineAt(editor.document.positionAt(item.end)).range
  const startofline = line.start
  const endofline = line.end
  const end = item.end
  const version = item.value === 'latest' ? '*' : item.value
  const [satisfies, maxSatisfying] = checkVersion(version, versions)

  const formatError = (error: string) => {
    // Markdown does not like newlines in middle of emphasis, or spaces next to emphasis characters.
    const error_parts = error.split('\n')
    const markdown = new MarkdownString('#### Errors ')
    markdown.appendMarkdown('\n')
    // Ignore empty strings
    error_parts.filter(s => s).forEach(part => {
      markdown.appendMarkdown('* ')
      markdown.appendText(part.trim()) // Gets rid of Markdown-breaking spaces, then append text safely escaped.
      markdown.appendMarkdown('\n') // Put the newlines back
    })
    return markdown
  }
  let hoverMessage = new MarkdownString()
  let contentText = ''
  if (error) {
    hoverMessage = formatError(error)
    // errorDecorator.replace("${version}", versions[0]);
    contentText = errorDecorator
  }
  if (info) {
    hoverMessage = new MarkdownString('#### Info \n').appendMarkdown(`* ${info}`)
    contentText = compatibleDecorator.replace('${version}', '')
  }
  if (!error && !info) {
    hoverMessage.appendMarkdown('#### Versions')
    const registryName = item.registry === 'pypi'
      ? 'Check PyPI'
      : item.registry === 'go'
        ? 'Check pkg.go.dev'
        : item.registry === 'maven' ? 'Check Maven Central' : 'Check NPM'
    const registryUrl = item.registry === 'pypi'
      ? `https://pypi.org/project/${item.key}/`
      : item.registry === 'go'
        ? `https://pkg.go.dev/${item.key}`
        : item.registry === 'maven'
          ? `https://central.sonatype.com/artifact/${item.key.replace(':', '/')}`
          : `https://www.npmjs.com/package/${item.key.replace(/"/g, '')}`
    hoverMessage.appendMarkdown(` _( [${registryName}](${registryUrl}) )_`)
    hoverMessage.isTrusted = true

    if (versions.length > 0) {
      replaceItems?.push({
        // Plain-text formats keep the operator outside the replacement range.
        item: item.plainVersion ? versions[0] : `"${versions[0]}"`,
        start,
        end,
        plain: item.plainVersion,
      })
    }

    const prefix = item.plainVersion ? '' : (prefixs.includes(version[0]) ? version[0] : '')
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i]
      const replaceData: ReplaceItem = {
        item: item.plainVersion ? version : `"${prefix}${version}"`,
        start,
        end,
        plain: item.plainVersion,
      }
      const isCurrent = version === maxSatisfying
      const encoded = encodeURI(JSON.stringify(replaceData))
      // const docs = (i === 0 || isCurrent) ? `[(docs)](https://docs.rs/crate/${item.key}/${version})` : ''
      const command = `${isCurrent ? '**' : ''}[${version}](command:depdetect.replaceVersion?${encoded})${isCurrent ? '**' : ''}`
      hoverMessage.appendMarkdown('\n * ')
      hoverMessage.appendMarkdown(command)
    }
    if (version === `${prefix}?`) {
      const version = versions[0]
      const info: ReplaceItem = {
        item: item.plainVersion ? version : `"${prefix}${version}"`,
        start,
        end,
        plain: item.plainVersion,
      }
      // decoPositon = + version.length;
      editor.edit(edit => {
        edit.replace(
          new Range(
            editor.document.positionAt(info.plain ? info.start : info.start + 1),
            editor.document.positionAt(info.plain ? info.end : info.end - 1),
          ),
          info.plain ? info.item : info.item.substr(1, info.item.length - 2),
        )
      })
      editor.document.save()
    }

    let latestText = compatibleDecorator.replace('${version}', versions[0])
    if (!validRange(version)) {
      latestText = errorDecorator.replace('${version}', versions[0])
    }
    else if (versions[0] !== maxSatisfying) {
      if (satisfies)
        latestText = compatibleDecorator.replace('${version}', versions[0])
      else
        latestText = incompatibleDecorator.replace('${version}', versions[0])
    }
    contentText = latestText
  }

  const deco = {
    range: new Range(
      startofline,
      endofline,
    ),
    hoverMessage,
    renderOptions: {
      after: {},
    },
  }
  if (version !== '?' && contentText.length > 0) {
    const lineLength = editor.document.lineAt(startofline.line).text.length
    const gap = Math.max(2, (markerColumn ?? lineLength + 2) - lineLength)
    deco.renderOptions.after = {
      contentText,
      // `ch` follows the editor's monospace glyph width and keeps every
      // status marker in the same visual column.
      margin: `0 0 0 ${gap}ch`,
    }
  }

  return deco
}
