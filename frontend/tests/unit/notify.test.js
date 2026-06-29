// Unit tests for the in-app toast glue that turns a realtime `tatva_notification` socket event into a
// native frappe-ui toast (Notifications.vue only silently reloads the bell). Pins the handler the socket
// fires: the joined title/body message, the conditional router action, and the drop-silently guards —
// if any drift, a rep would get an empty/duplicate toast or a dead "View" link.
import { startTatvaNotify } from '@/tatva/notify'
import { toast } from 'frappe-ui'
import router from '@/router'

vi.mock('frappe-ui', () => ({ toast: { create: vi.fn() } }))
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))

// notify.js has a module-level `started` guard, so only the FIRST startTatvaNotify call ever registers.
// Register the fake socket ONCE for the whole module lifetime and capture the real handler; each test
// then invokes the captured handler directly.
const handlers = {}
let handler

beforeAll(() => {
  const socket = { on: (event, cb) => { handlers[event] = cb } }
  startTatvaNotify(socket)
  handler = handlers['tatva_notification']
})

beforeEach(() => {
  vi.clearAllMocks()
})

it('registered exactly one handler for the tatva_notification event', () => {
  expect(typeof handler).toBe('function')
  expect(Object.keys(handlers)).toEqual(['tatva_notification'])
})

it('joins title and body with " — " and adds a router action for the route', () => {
  handler({ title: 'New lead', body: 'Asha assigned', route: '/crm/leads/L1' })

  expect(toast.create).toHaveBeenCalledTimes(1)
  const arg = toast.create.mock.calls[0][0]
  expect(arg.message).toBe('New lead — Asha assigned')
  expect(arg.type).toBe('info')
  expect(arg.action).toBeTruthy()

  expect(router.push).not.toHaveBeenCalled()
  arg.action.onClick()
  expect(router.push).toHaveBeenCalledWith('/crm/leads/L1')
})

it('shows the toast with no action when the payload has no route', () => {
  handler({ title: 'New lead', body: 'Asha assigned' })

  expect(toast.create).toHaveBeenCalledTimes(1)
  expect(toast.create.mock.calls[0][0].action).toBeUndefined()
})

it('drops a falsy payload without showing a toast', () => {
  handler(null)
  handler(undefined)
  expect(toast.create).not.toHaveBeenCalled()
})

it('drops a payload with neither title nor body (empty message)', () => {
  handler({ route: '/crm/leads/L1' })
  expect(toast.create).not.toHaveBeenCalled()
})
