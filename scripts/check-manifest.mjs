#!/usr/bin/env node
/**
 * Fail when the three places that name the plugin drift apart.
 *
 * The package name is repeated in cordis.patch.yml and baked into the client
 * bundle as the module loader id; a rename that updates only one of them
 * installs cleanly and then silently fails to show a panel. `files` likewise
 * has to keep shipping the Host entry and the built client.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.join(root, file), 'utf8')

const pkg = JSON.parse(read('package.json'))
const problems = []

const patch = read('cordis.patch.yml')
const patchName = patch.match(/^\s*name:\s*'([^']+)'\s*$/m)?.[1]
if (patchName !== pkg.name) {
  problems.push(`cordis.patch.yml name: ${JSON.stringify(patchName)} != package name ${JSON.stringify(pkg.name)}`)
}

const bundleId = read('dist/client.js').match(/^\s{2}id:\s*"([^"]+)",/m)?.[1]
if (bundleId !== pkg.name) {
  problems.push(
    `dist/client.js loader id: ${JSON.stringify(bundleId)} != package name ${JSON.stringify(pkg.name)} — rebuild with \`pnpm run build\``,
  )
}

for (const [key, target] of [
  ['./client', 'dist/client.js'],
  ['./icon', 'icon.svg'],
]) {
  const declared = pkg.exports?.[key]
  if (typeof declared !== 'string') {
    problems.push(`exports[${JSON.stringify(key)}] is missing`)
    continue
  }
  const normalized = declared.replace(/^\.\//, '')
  if (normalized !== target) {
    problems.push(`exports[${JSON.stringify(key)}] points at ${declared}, expected ./${target}`)
  }
  if (!existsSync(path.join(root, normalized))) {
    problems.push(`exports[${JSON.stringify(key)}] target ${declared} does not exist`)
  }
}

for (const required of ['index.js', 'dist', 'src/host', 'cordis.patch.yml']) {
  if (!pkg.files?.includes(required)) problems.push(`files[] does not ship ${required}`)
}

if (!existsSync(path.join(root, pkg.main ?? 'index.js'))) problems.push(`main (${pkg.main}) does not exist`)

if (problems.length > 0) {
  for (const problem of problems) console.error(`manifest: ${problem}`)
  process.exit(1)
}
console.log(`manifest: ok (${pkg.name}@${pkg.version})`)
