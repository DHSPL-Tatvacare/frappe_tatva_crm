// ONE shared mount brain for tatva component tests (C.26 — no per-spec copy-paste). Mounts a component
// in happy-dom with the frappe-ui overlay/teleporting primitives stubbed to render their slot inline
// (so assertions don't chase teleported DOM), and router-link stubbed. Real frappe-ui leaf components
// (Button, FormControl, FeatherIcon) render for real so click/emit contracts are genuine.
import { mount, RouterLinkStub } from '@vue/test-utils'

// Functional slot-passthrough stub for overlay comps that teleport (Dialog/Popover/Dropdown). Exposes
// a default slot with the slot-props those comps provide (`open`) so trigger templates still render.
const overlayStub = (name) => ({
  name: `${name}Stub`,
  template: `<div :data-stub="'${name}'"><slot :open="false" /><slot name="body" /></div>`,
})

export function mountTatva(component, options = {}) {
  const { global: g = {}, ...rest } = options
  return mount(component, {
    ...rest,
    global: {
      ...g,
      // Mirror the app: `__` (i18n) is a Vue global property, so templates' `_ctx.__` resolves.
      config: { globalProperties: { __: globalThis.__, ...(g.config?.globalProperties || {}) } },
      stubs: {
        Dialog: overlayStub('Dialog'),
        Popover: overlayStub('Popover'),
        Dropdown: overlayStub('Dropdown'),
        // Heavy children that are never the contract-under-test: a rich-text editor and the avatar.
        TextEditor: { name: 'TextEditorStub', template: '<div data-stub="TextEditor"><slot /></div>' },
        UserAvatar: { name: 'UserAvatarStub', template: '<span data-stub="UserAvatar" />' },
        RouterLink: RouterLinkStub,
        teleport: true,
        ...(g.stubs || {}),
      },
      mocks: { ...(g.mocks || {}) },
      plugins: [...(g.plugins || [])],
      provide: { ...(g.provide || {}) },
    },
  })
}

export { RouterLinkStub }
