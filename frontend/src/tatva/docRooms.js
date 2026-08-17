// TATVA: doc-room membership that survives a reconnect — frappe's handlers re-join only user:/website:/all, so every doc: room dies on a wifi drop or a websocket restart.

// Frappe's own registry shape (`socketio_client.js` keeps `open_docs` keyed doctype:docname), holding the pair a rejoin re-emits.
const openDocs = new Map()

// The default 5s cap would knock on every 5s for ever at an unreachable or a refusing server.
const RETRY_DELAY_MAX_MS = 30000

let socket = null
let started = false

const key = (doctype, name) => `${doctype}:${name}`

// Socketio admits us only if we may READ the record, so the scope stays frappe's permission check.
export function docSubscribe(doctype, name) {
  if (!doctype || !name) return
  openDocs.set(key(doctype, name), [doctype, name])
  socket?.emit('doc_subscribe', doctype, name)
}

export function docUnsubscribe(doctype, name) {
  if (!doctype || !name) return
  openDocs.delete(key(doctype, name))
  socket?.emit('doc_unsubscribe', doctype, name)
}

// Core's 1/sec subscribe throttle is deliberately not copied — it silently drops a second join.
function rejoin() {
  openDocs.forEach(([doctype, name]) =>
    socket.emit('doc_subscribe', doctype, name),
  )
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
