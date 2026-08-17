// Unit tests for doc-room membership across a reconnect. Frappe's socketio re-joins only user:/website:/all,
// so without this the workflow canvas and a lead's WhatsApp/telephony events go quiet for the life of the page.
import {
  docSubscribe,
  docUnsubscribe,
  startTatvaDocRooms,
} from '@/tatva/docRooms'

// docRooms.js has a module-level `started` guard, so only the FIRST start ever registers. Register the
// fake socket ONCE and capture the handlers; each test then invokes the captured handler directly.
const socket = {
  connected: false,
  emit: vi.fn(),
  on: (event, cb) => {
    handlers[event] = cb
  },
  // Plain recorders, not spies — these are called once at start, before any clearAllMocks.
  io: {
    reconnectionAttempts: (v) => manager.attempts.push(v),
    reconnectionDelayMax: (v) => manager.delayMax.push(v),
  },
}
const handlers = {}
const manager = { attempts: [], delayMax: [] }

beforeAll(() => {
  startTatvaDocRooms(socket)
})

beforeEach(() => {
  vi.clearAllMocks()
})

it('subscribes on join and unsubscribes on leave', () => {
  docSubscribe('CRM Lead', 'L1')
  expect(socket.emit).toHaveBeenCalledWith('doc_subscribe', 'CRM Lead', 'L1')

  docUnsubscribe('CRM Lead', 'L1')
  expect(socket.emit).toHaveBeenCalledWith('doc_unsubscribe', 'CRM Lead', 'L1')
})

it('re-joins every held room on connect, and nothing that was left', () => {
  docSubscribe('CRM Lead', 'L1')
  docSubscribe('CRM Workflow', 'W1')
  docSubscribe('CRM Lead', 'L2')
  docUnsubscribe('CRM Lead', 'L2')
  vi.clearAllMocks()

  handlers['connect']()

  expect(socket.emit).toHaveBeenCalledWith('doc_subscribe', 'CRM Lead', 'L1')
  expect(socket.emit).toHaveBeenCalledWith(
    'doc_subscribe',
    'CRM Workflow',
    'W1',
  )
  expect(socket.emit).toHaveBeenCalledTimes(2)

  docUnsubscribe('CRM Lead', 'L1')
  docUnsubscribe('CRM Workflow', 'W1')
})

it('keeps a name containing a colon whole', () => {
  docSubscribe('CRM Workflow', 'TP: Welcome Call')
  vi.clearAllMocks()

  handlers['connect']()

  expect(socket.emit).toHaveBeenCalledWith(
    'doc_subscribe',
    'CRM Workflow',
    'TP: Welcome Call',
  )
  docUnsubscribe('CRM Workflow', 'TP: Welcome Call')
})

it('retries for ever but slowly, so the socket never gives up and never knocks every 5s', () => {
  expect(manager.attempts).toEqual([Infinity])
  expect(manager.delayMax).toEqual([30000])
})

it('ignores a blank doctype or name', () => {
  docSubscribe('CRM Lead', '')
  docSubscribe('', 'L1')
  docUnsubscribe('CRM Lead', undefined)
  expect(socket.emit).not.toHaveBeenCalled()

  handlers['connect']()
  expect(socket.emit).not.toHaveBeenCalled()
})
