// TATVA: doc-room membership that survives a reconnect — frappe's handlers re-join only user:/website:/all, so every doc: room dies on a wifi drop or a websocket restart.

// Frappe's two per-record rooms and the events that join and leave them: `doc:` hears a record's realtime, `open_doc:` is who is viewing it (`doc_viewers`).
const ROOMS = {
  subscribe: ['doc_subscribe', 'doc_unsubscribe'],
  open: ['doc_open', 'doc_close'],
}

// Frappe's own registry shape (`socketio_client.js` keeps `open_docs` keyed doctype:docname), counted per holder so one leaving keeps the room for the rest.
const held = new Map()

// The default 5s cap would knock on every 5s for ever at an unreachable or a refusing server.
const RETRY_DELAY_MAX_MS = 30000

let socket = null
let started = false

const key = (room, doctype, name) => `${room}:${doctype}:${name}`

// Socketio admits us only if we may READ the record, so the scope stays frappe's permission check.
function join(room, doctype, name) {
  if (!doctype || !name) return
  const k = key(room, doctype, name)
  const entry = held.get(k)
  if (entry) return entry.count++
  held.set(k, { room, doctype, name, count: 1 })
  socket?.emit(ROOMS[room][0], doctype, name)
}

function leave(room, doctype, name) {
  const k = key(room, doctype, name)
  const entry = held.get(k)
  if (!entry || --entry.count) return
  held.delete(k)
  socket?.emit(ROOMS[room][1], doctype, name)
}

export const docSubscribe = (doctype, name) => join('subscribe', doctype, name)
export const docUnsubscribe = (doctype, name) => leave('subscribe', doctype, name)
export const docOpen = (doctype, name) => join('open', doctype, name)
export const docClose = (doctype, name) => leave('open', doctype, name)

// Core's 1/sec subscribe throttle is deliberately not copied — it silently drops a second join.
function rejoin() {
  held.forEach(({ room, doctype, name }) => socket.emit(ROOMS[room][0], doctype, name))
}

export function startTatvaDocRooms(crmSocket) {
  if (started || !crmSocket) return
  started = true
  socket = crmSocket

  // A reconnect is a new socket id with no rooms; re-join whatever the open page still needs.
  crmSocket.on('connect', rejoin)
  // Retry for ever, slowly — socket.io's own knobs (they reach the live backoff), so no retry loop of ours.
  crmSocket.io?.reconnectionAttempts?.(Infinity)
  crmSocket.io?.reconnectionDelayMax?.(RETRY_DELAY_MAX_MS)
  // A page that subscribed before App.vue started us holds a room nobody has emitted yet.
  if (crmSocket.connected) rejoin()
}
