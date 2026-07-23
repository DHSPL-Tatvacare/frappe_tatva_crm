// MSW server for component tests — adopts frappe-ui's own convention (Vitest + msw/node) so resource-
// driven components are tested by mocking the Frappe REST API at the network boundary, never by stubbing
// createResource internals. Lifecycle is wired in _setup.js (a Vitest setupFile).
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// A debounced background fetch can fire AFTER a test's per-test handlers are reset in afterEach — the
// clearest case is NodeInspector's node_context (frappe-ui debounce:300, which exposes no cancel handle
// and isn't tied to Vue's scope), whose reload lands once the mock is gone and rejects against a dead
// origin, failing the whole run even when every test passes. This is a TEST-lifecycle artifact, not a
// product defect (in prod the real endpoint answers into a GC'd resource). A permanent default handler —
// kept across server.resetHandlers() — answers such late fetches benignly; per-test mockFrappeMethod
// still overrides it DURING each test (msw runtime handlers win), so no assertion is affected.
const NODE_CONTEXT = '*/api/method/tatva_connect.workflow_engine.context.node_context'
const nodeContextDefault = () =>
  HttpResponse.json({
    message: { subject: '', grain: {}, variables: [], emitters: [], settable: [], operators_by_type: {}, operator_shapes: {} },
  })
export const server = setupServer(
  http.get(NODE_CONTEXT, nodeContextDefault),
  http.post(NODE_CONTEXT, nodeContextDefault),
)

// Mock a Frappe whitelisted method (createResource with a dotted url → /api/method/<dotted>, returns
// `message`). Registered for both GET and POST so it matches regardless of how the resource transports.
export function mockFrappeMethod(dottedMethod, message) {
  const path = `*/api/method/${dottedMethod}`
  const respond = () => HttpResponse.json({ message })
  server.use(http.get(path, respond), http.post(path, respond))
}

// Mock a Frappe REST list/resource read (createResource with a doctype → /api/resource/<Doctype>,
// returns `data`).
export function mockFrappeResource(doctype, data) {
  const path = `*/api/resource/${encodeURIComponent(doctype)}`
  const respond = () => HttpResponse.json({ data })
  server.use(http.get(path, respond), http.post(path, respond))
}

export { http, HttpResponse }
