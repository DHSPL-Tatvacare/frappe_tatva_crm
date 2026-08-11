import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// TATVA: `vh` is the viewport with the browser toolbar RETRACTED, so on a phone it overshoots the screen — measured on iOS Chrome, `100vh` resolved to 874px on a 688px screen while `100dvh` gave the true 688px. Anything sized to fit the screen uses `dvh`. Cleaning these up once does not hold; this check is what holds.
const SRC = resolve(process.cwd(), 'src')
const SKIP_DIRS = ['Icons'] // base64 sprites contain byte runs that read as `NNvh`
const BANNED = /\b(?:min-h|max-h|h)-screen\b|\[[^\]]*?\d+(?:\.\d+)?vh/

const sources = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return SKIP_DIRS.includes(e.name) ? [] : sources(path)
    return /\.(vue|js|ts|css)$/.test(e.name) ? [path] : []
  })

const isComment = (line) => /^\s*(<!--|\/\/|\/\*|\*)/.test(line)

describe('viewport units', () => {
  it('sizes every screen-fitting element in dvh, never vh', () => {
    const offenders = sources(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          !isComment(line) && BANNED.test(line)
            ? [`${relative(SRC, file)}:${i + 1}  ${line.trim()}`]
            : [],
        ),
    )
    expect(offenders, `use dvh, not vh:\n${offenders.join('\n')}`).toEqual([])
  })
})
