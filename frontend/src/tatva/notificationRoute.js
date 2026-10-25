// TATVA: the ONE route a tray row opens, read by the desktop tray and the mobile page; `route_name` comes from tatva_connect.notifications.tray.
export function notificationRoute(notification, hash) {
  const name = notification.route_name
  // A notice the app has no screen for has no route; the tray draws it without a link and the click still marks it read.
  if (!name) return null
  // A notice naming no record opens its list, drilled as its email and push are.
  if (!notification.reference_name) return { name, params: { viewType: 'list' }, query: notification.route_query || {} }
  if (name === 'SmartViews') {
    return { name, query: { view: notification.reference_name } }
  }
  const key = name === 'Deal' ? 'dealId' : 'leadId'
  return { name, params: { [key]: notification.reference_name }, hash }
}
