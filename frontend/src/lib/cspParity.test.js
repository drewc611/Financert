import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/* Two files state the Content-Security-Policy: vite.config.js writes it into
   index.html as a <meta> tag, and nginx.conf sends it as a header on the Docker
   path. They must not drift, or the stricter one silently wins and the app
   breaks only in one deployment. The nginx copy differs in exactly two ways:
   it adds frame-ancestors (meta tags cannot carry it) and has a placeholder
   where the API origin goes. */

const read = (name) => readFileSync(fileURLToPath(new URL(`../../${name}`, import.meta.url)), 'utf8')

function viteDirectives() {
  const block = read('vite.config.js').match(/const CSP = \[([\s\S]*?)\]\.join/)[1]
  // Quoted strings only; the comment lines between the entries are skipped.
  return [...block.matchAll(/^\s*(["`])(.+?)\1,?\s*$/gm)].map((m) => m[2].replace('${API_ORIGIN}', '__API_ORIGIN__'))
}

function nginxDirectives() {
  const header = read('nginx.conf').match(/add_header Content-Security-Policy "([^"]+)"/)[1]
  return header.split(';').map((d) => d.trim())
}

describe('Content-Security-Policy in vite.config.js and nginx.conf', () => {
  it('states the same directives, apart from frame-ancestors', () => {
    const fromNginx = nginxDirectives()
    expect(fromNginx).toContain("frame-ancestors 'none'")
    expect(fromNginx.filter((d) => !d.startsWith('frame-ancestors'))).toEqual(viteDirectives())
  })

  it('sends the other security headers', () => {
    const conf = read('nginx.conf')
    for (const header of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']) {
      expect(conf).toMatch(new RegExp(`add_header ${header} "[^"]+" always;`))
    }
  })

  it('adds no add_header inside a location, which would replace the inherited set', () => {
    const code = read('nginx.conf').replace(/#.*$/gm, '')
    const locations = code.match(/location [^{]+\{[^}]*\}/g) ?? []
    expect(locations.length).toBeGreaterThan(0)
    for (const block of locations) expect(block).not.toContain('add_header')
  })
})
