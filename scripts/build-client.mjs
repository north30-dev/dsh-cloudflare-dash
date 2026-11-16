/**
 * Build the browser half of the plugin.
 *
 * The Web module loader expects one self-registering bundle per package: a
 * `window.__ModuleLoader__.load({ id, factory })` call whose factory returns the
 * Cordis plugin. The bundle must stay self-contained because a plugin bundle is
 * a single module node in the loader; React is resolved through the loader's
 * `require` and must not be inlined.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const outfile = path.join(root, 'dist', 'client.js')

mkdirSync(path.join(root, 'dist'), { recursive: true })

await build({
  absWorkingDir: root,
  entryPoints: ['src/client/index.jsx'],
  outfile: 'dist/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'transform',
  external: ['react'],
  loader: { '.css': 'text' },
  legalComments: 'none',
  logLevel: 'info',
  banner: {
    js: [
      'window.__ModuleLoader__.load({',
      `  id: ${JSON.stringify(pkg.name)},`,
      '  factory(require) {',
      '    var module = { exports: {} };',
      '    var exports = module.exports;',
    ].join('\n'),
  },
  footer: {
    js: ['    return module.exports;', '  },', '});', ''].join('\n'),
  },
})
