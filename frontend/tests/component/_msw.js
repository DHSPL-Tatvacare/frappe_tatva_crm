// MSW server for component tests — adopts frappe-ui's own convention (Vitest + msw/node) so resource-
// driven components are tested by mocking the Frappe REST API at the network boundary, never by stubbing
// createResource internals. Lifecycle is wired in _setup.js (a Vitest setupFile).
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const server = setupServer()

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
