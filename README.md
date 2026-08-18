<p align="center">
<img src="./res/logo.png" height="100">
</p>
<h1 align="center">depdetect</h1>

<p align="center">
<a href="https://marketplace.visualstudio.com/items?itemName=ririd.depdetect" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/ririd.depdetect.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>
</p>

<p align="center">
DepDetect is a VS Code extension for Node.js, Python, and Go dependencies. It helps developers inspect and update versions directly in project dependency files.
</p>

## Features

- Displays the latest version of npm, PyPI, and Go modules next to them.
- Shows all versions (clickable) on the tooltip of a hovered dependency.
- Supports `package.json`, Python `requirements.txt` and `pyproject.toml`, and Go `go.mod` files.
- Supports replacing one dependency or updating all displayed dependencies at once.

## Refreshing version data

Version metadata is fetched when a supported dependency file is first opened. Editing
or saving the file only reparses the document and moves the existing
decorations; it does not start another registry request. Opening a source
control diff also avoids a registry request. Use `DepDetect: Retry to fetch
dependency versions` when dependencies are added or you explicitly need the latest
metadata.

## Preview

![preview](./screenshots/preview.gif)

## Known Issues
Newly added dependencies are shown after the next explicit retry because
editing and saving do not automatically query the registry.

## Thanks

`depdetect` is inspired by [crates](https://github.com/serayuzgur/crates), which is an extension for managing Rust dependencies.

## Upstream and attribution

This project is a modified fork of [Riri's vscode-ext-packages](https://github.com/Daydreamer-riri/vscode-ext-packages), originally released under the MIT License.

The original work is Copyright © 2023 [Riri](https://github.com/Daydreamer-riri). Modifications in this repository are Copyright © 2026 funkpopo. The complete copyright and permission notices are retained in [LICENSE](./LICENSE).

## License

Distributed under the [MIT License](./LICENSE).
