/**
 * Build script for the client half of the plugin.
 *
 * The Harness loads client modules as single bundles through its own module
 * loader, so the client code is bundled into `client.js`. The sources stay in
 * `src/client/`, one file per page, and the bundle itself is committed so that
 * installing the plugin needs no build step.
 *
 * `react` comes from the loader, as the Harness provides it; the JSX runtime is
 * bundled, so the plugin needs nothing beyond the loader.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const entry = join(here, 'src', 'client', 'entry.js')
const template = join(here, 'src', 'client', 'bundle-template.js')
const bundle = join(here, 'client.js')
const temporary = join(here, 'node_modules', '.dsh-ssh-client-bundle.js')

execFileSync(
  'npx',
  [
    'esbuild',
    entry,
    '--bundle',
    '--format=iife',
    '--global-name=__dshSshClient',
    `--outfile=${temporary}`,
    '--external:react',
    '--legal-comments=none',
  ],
  { cwd: here, stdio: 'inherit' },
)

const compiled = readFileSync(temporary, 'utf8')
const shell = readFileSync(template, 'utf8')
// A function replacement keeps the text as it is: the string form of replace
// treats `$` in the replacement as a substitution pattern, and the bundle
// contains `$$typeof`, which would lose one `$` and break every element.
const output = shell.replace('__DSH_SSH_INSTALL__', () => compiled)
writeFileSync(bundle, output)

console.log(`built ${bundle}`)
