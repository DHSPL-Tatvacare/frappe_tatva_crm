// TATVA: the ONE surface gate — which whole screens exist for this user, decided by one server rule
// (tatva_connect.access.surfaces.my_surfaces) and carried on the boot payload the page already serves.
// SYNCHRONOUS on purpose: this replaced three boot-time gate calls (near_me_access, workflow_access and
// the deals gate that would have been a third) with one boot key, so the menu is correct at FIRST PAINT
// instead of popping in. Never add a call() here — a request is exactly what this file exists to remove.
const boot = () => (typeof window !== 'undefined' && window.surfaces) || {}

// Read on ACCESS, not at import: `crm.html` writes `window.surfaces` before any script runs, but the dev
// server fills the boot keys just before mount, and a snapshot taken at import would be empty there.
// Fail-closed, same as the gates this replaced: a missing payload or a missing key reads false.
export const surfaces = {
  get near_me() {
    return !!boot().near_me
  },
  get workflows() {
    return !!boot().workflows
  },
  get deals() {
    return !!boot().deals
  },
  // Contacts and Organizations exist to be sold to, so the server rides them on the same Deals liveness.
  get contacts() {
    return !!boot().contacts
  },
  get organizations() {
    return !!boot().organizations
  },
}

// The awaitable the route guards wait on, kept from `nearMeReady`: a direct URL is judged by the settled
// answer, never by a not-yet-resolved default. Already resolved, because the answer arrived with the page.
export const surfacesReady = Promise.resolve(surfaces)
