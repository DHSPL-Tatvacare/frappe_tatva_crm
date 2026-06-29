// Vitest setupFile (component layer): MSW server lifecycle. `bypass` keeps the pure-logic unit tests
// (which make no requests) unaffected; component specs register handlers per-test via mockFrappe*.
import { beforeAll, afterEach, afterAll } from 'vitest'
import { setConfig, frappeRequest } from 'frappe-ui'
import { server } from './_msw.js'

// Mirror the app boot (main.js): createResource routes through frappeRequest, so a dotted method url
// becomes /api/method/<method> — which the MSW handlers mock. Without this, resources hit a raw origin
// URL and bypass the mocks.
setConfig('resourceFetcher', frappeRequest)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
