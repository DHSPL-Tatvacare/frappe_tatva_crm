// One reload in flight at a time; every event that lands meanwhile collapses into a single follow-up reload.
export function coalescedReload(...resources) {
  let running = null
  let again = false
  const run = () => {
    if (running) {
      again = true
      return running
    }
    running = Promise.allSettled(resources.map((resource) => resource.reload())).finally(() => {
      running = null
      if (again) {
        again = false
        run()
      }
    })
    return running
  }
  return run
}
