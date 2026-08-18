import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs'],
  target: 'node22',
  shims: false,
  dts: false,
  external: [
    'vscode',
  ],
})
