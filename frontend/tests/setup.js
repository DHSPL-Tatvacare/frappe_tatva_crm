// Minimal globals that CRM code expects
globalThis.__ = (msg, args) => {
  if (!args) return msg
  let str = msg
  if (Array.isArray(args)) {
    args.forEach((arg, i) => {
      str = str.replace(`{${i}}`, arg)
    })
  }
  return str
}

globalThis.window = globalThis.window || {}
// Boot defaults the app receives from the server; date/time formats are read by utils/formatDate.
globalThis.window.sysdefaults = {
  currency: 'USD',
  date_format: 'dd-mm-yyyy',
  time_format: 'HH:mm:ss',
}
