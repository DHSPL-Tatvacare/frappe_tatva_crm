// TATVA: keeps <meta name="theme-color"> — what iOS tints its browser chrome from — on the live theme, read from the --surface-white token so no colour is written down anywhere. frappe-ui's useTheme, stores/theme.js and the system-change listener share no state; the `data-theme` attribute is the only thing all three write, so it is the hook.
export function startThemeColorSync() {
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }

  const apply = () => {
    const surface = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface-white')
      .trim()
    if (surface) meta.setAttribute('content', surface)
  }

  apply()
  new MutationObserver(apply).observe(document.documentElement, {
    attributeFilter: ['data-theme'],
  })
}
