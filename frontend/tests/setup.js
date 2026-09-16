/* Setup for the jsdom project (BACKLOG F69). */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/* Testing Library registers this itself when a test runner puts afterEach on
   the global, which vitest does only with `globals: true`. The tests here
   import from 'vitest' explicitly, so the cleanup has to be wired by hand --
   without it every render stays in the document and the next test's query
   matches the previous test's markup. */
afterEach(cleanup)
