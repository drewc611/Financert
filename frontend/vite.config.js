import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* The API the built app is allowed to talk to. Same expression src/lib/api.js
   uses, so the policy and the client cannot disagree about where requests go. */
const API_ORIGIN = new URL(process.env.VITE_API_BASE || 'http://localhost:8000').origin

/* Content-Security-Policy, injected into the built index.html.
 *
 * A <meta> tag rather than a response header because the published surface is
 * GitHub Pages (see .github/workflows/pages.yml), which serves static files and
 * gives you no way to set one. A meta CSP is enforced for everything the parser
 * reaches after it, which is the whole app -- the one directive it cannot carry
 * is `frame-ancestors`, so that is deliberately absent rather than written and
 * silently ignored.
 *
 * script-src is the strict one: no 'unsafe-inline', no 'unsafe-eval', no
 * external origin, and no hashes needed, because index.html carries exactly one
 * <script> and it has a src. Keep it that way -- an inline <script> added later
 * will not run, and the fix for that is a real file, not a hash.
 *
 * style-src keeps 'unsafe-inline' because the charts set style attributes on the
 * elements they render, which a hash cannot cover without 'unsafe-hashes'.
 * Inline CSS is a far weaker sink than inline JS.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // The favicon is an inline SVG data: URI in index.html.
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${API_ORIGIN}`,
  "manifest-src 'self'",
  // The installable app registers /sw.js (src/main.jsx).
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/* Build only. Vite's dev server injects its own inline scripts for HMR and the
   React refresh runtime, so enforcing this under `vite dev` would break the dev
   server rather than the thing it is meant to protect. */
function contentSecurityPolicy() {
  return {
    name: 'financert-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
    },
  }
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
  /* Two projects, split by what the test actually needs (BACKLOG F69).
   *
   * The src/lib tests are pure functions over data and run in node -- which is
   * why scenarios.test.js stubs localStorage rather than taking on a DOM for
   * one API with four methods. Component tests need a document, so they get
   * jsdom and pay its startup cost; keeping that cost off the function tests is
   * the whole reason for the split.
   *
   * The extension is the selector: .test.js is a function, .test.jsx is a
   * component. `extends: true` inherits the React plugin above, without which
   * the JSX in the component tests would not compile.
   */
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.js'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'components',
          include: ['src/**/*.test.jsx'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup.js'],
        },
      },
    ],
  },
})
