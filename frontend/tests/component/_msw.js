// MSW server for component tests — adopts frappe-ui's own convention (Vitest + msw/node) so resource-
// driven components are tested by mocking the Frappe REST API at the network boundary, never by stubbing
// createResource internals. Lifecycle is wired in _setup.js (a Vitest setupFile).
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// No default handlers: a component is unmounted with its test (enableAutoUnmount in _setup.js) and cancels
// its own scheduled work, so nothing should reach the network after a test. An unmocked request is a defect.
export const server = setupServer()

// Mock a Frappe whitelisted method (createResource with a dotted url → /api/method/<dotted>, returns
// `message`). Registered for both GET and POST so it matches regardless of how the resource transports.
export function mockFrappeMethod(dottedMethod, message) {
  const path = `*/api/method/${dottedMethod}`
  const respond = () => HttpResponse.json({ message })
  server.use(http.get(path, respond), http.post(path, respond))
}

// Mock the ONE answer the canvas asks about a graph — `{outputs, context}`, both halves of one question.
// It answers for whichever nodes it is ASKED about, exactly as the endpoint does, and splits `variables` on the `emitted` flag the rows already carry — so a fixture stays a per-node answer and no test has to hand-write the graph shape.
// `outputs` may be a map or a function of the posted rows, because a mock returning a constant cannot see a stale input — which is the whole point of the pruning specs.
export function mockGraphContext({ outputs = {}, variables = [], emitters = [], ...rest }) {
  const path = `*/api/method/tatva_connect.workflow_engine.context.graph_context`
  const respond = async ({ request }) => {
    const nodes = await askedNodes(request)
    const asked = nodes.map((n) => n.node_id)
    return HttpResponse.json({
      message: {
        outputs: typeof outputs === 'function' ? outputs(nodes) : outputs,
        context: {
          ...rest,
          subject_fields: variables.filter((v) => !v.emitted),
          nodes: Object.fromEntries(
            asked.map((id) => [
              id,
              { emitted: variables.filter((v) => v.emitted), emitters },
            ]),
          ),
        },
      },
    })
  }
  server.use(http.get(path, respond), http.post(path, respond))
}

async function askedNodes(request) {
  try {
    const body = await request.clone().json()
    const nodes = body.nodes
    return (typeof nodes === 'string' ? JSON.parse(nodes || '[]') : nodes) || []
  } catch {
    return []
  }
}

// Mock a Frappe REST list/resource read (createResource with a doctype → /api/resource/<Doctype>,
// returns `data`).
export function mockFrappeResource(doctype, data) {
  const path = `*/api/resource/${encodeURIComponent(doctype)}`
  const respond = () => HttpResponse.json({ data })
  server.use(http.get(path, respond), http.post(path, respond))
}

export { http, HttpResponse }
