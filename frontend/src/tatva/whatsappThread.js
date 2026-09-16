import { computed, ref, watch } from 'vue'
import { call } from 'frappe-ui'

// Older pages held beside the newest page the resource reloads, served as one ordered thread.
export function useWhatsappThread(resource) {
  const older = ref([])
  const exhausted = ref(false)
  let loading = null

  const messages = computed(() => ordered([...older.value, ...(resource.data || [])]))
  const newest = computed(() => messages.value.at(-1)?.name)

  // A reload that still meets the page it replaced keeps that page; one that does not would hide a gap, so history restarts.
  watch(
    () => resource.data,
    (page, previous) => {
      if (!previous?.length) return
      const meets = page?.some((row) => previous.some((held) => held.name === row.name))
      older.value = meets ? ordered([...older.value, ...previous]) : []
      if (!meets) exhausted.value = false
    },
  )

  function loadOlder() {
    if (loading || exhausted.value || !messages.value.length) return loading
    loading = call(resource.url, { ...resource.params, before: messages.value[0].name })
      .then((page) => {
        if (page?.length) older.value = ordered([...page, ...older.value])
        else exhausted.value = true
      })
      .finally(() => (loading = null))
    return loading
  }

  return { messages, newest, exhausted, loadOlder }
}

function ordered(rows) {
  const byName = new Map(rows.map((row) => [row.name, row]))
  return [...byName.values()].sort(
    (a, b) => a.creation.localeCompare(b.creation) || a.name.localeCompare(b.name),
  )
}
