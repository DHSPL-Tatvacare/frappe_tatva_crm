// TATVA: the ONE status→badge-theme map (was duplicated + divergent in TatvaTasks.vue and TaskModal.vue).
export function statusTheme(status) {
  return (
    {
      Done: 'green',
      Canceled: 'red',
      'In Progress': 'blue',
      Todo: 'gray',
      Backlog: 'orange',
    }[status] || 'gray'
  )
}
