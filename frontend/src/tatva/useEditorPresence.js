// TATVA: who else has an authored record open and which of them is editing — Frappe's `doc_viewers` plus the authoring mark, one brain for Workflows and Task Forms.
import { docClose, docOpen, docSubscribe, docUnsubscribe } from '@/tatva/docRooms'
import { globalStore } from '@/stores/global'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/users'
import { call, toast } from 'frappe-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// `method(action)` names the server verb as `useLifecycle` takes it, `loadedEditor()` reads the mark off the payload the page loaded, `editing()` is the page's own edit mode.
export function useEditorPresence({ doctype, name, method, loadedEditor, editing }) {
  const { $socket } = globalStore()
  const { getUser } = usersStore()
  const me = sessionStore().user

  // Everyone else with the record open; Frappe sends nothing while I am alone, so empty is the truth until it speaks.
  const viewing = ref([])
  // The mark as last announced; undefined until an announcement, so the loaded one stands.
  const announced = ref(undefined)

  // An editor counts only while they are viewing: a closed tab or a dropped socket leaves the room, so a stale mark reads as nobody.
  const editorId = computed(() => {
    const who = announced.value === undefined ? loadedEditor() : announced.value
    return who && who !== me && viewing.value.includes(who) ? who : null
  })
  const editor = computed(() => (editorId.value ? getUser(editorId.value).full_name : null))

  // MultipleAvatar's shape; `name` is its tooltip, so the editor's says so.
  const viewers = computed(() =>
    viewing.value.map((email) => {
      const user = getUser(email)
      return {
        name: email === editorId.value ? __('{0} (editing)', [user.full_name]) : user.full_name,
        label: user.full_name,
        image: user.user_image,
      }
    }),
  )

  function onViewers(data) {
    if (data?.doctype === doctype && data?.docname === name) viewing.value = (data.users || []).filter((u) => u !== me)
  }

  function onEditor(data) {
    if (data?.doctype === doctype && data?.name === name) announced.value = data.user
  }

  // The page's edit mode IS the mark: entering it sets mine, leaving it by any door clears it.
  function mark(action) {
    call(method(action), { name }).catch((e) => toast.error(e?.messages?.[0] || e?.message || __('That did not work')))
  }
  watch(editing, (on) => mark(on ? 'start_editing' : 'stop_editing'))
  // A mark of mine on a page that is not editing outlived a reload or a closed tab, which never unmount; the page clears it.
  watch(loadedEditor, (who) => who === me && !editing() && mark('stop_editing'), { immediate: true })

  // Edit's door while someone else edits: say who in ONE toast per record (frappe-ui stacks a toast per call, so a repeat replaces it by id) and open nothing.
  const takenToast = `editing:${doctype}:${name}`
  function warnIfTaken() {
    if (!editor.value) return false
    toast.remove(takenToast)
    toast.warning(__('{0} is editing', [editor.value]), { id: takenToast })
    return true
  }

  onMounted(() => {
    docOpen(doctype, name)
    docSubscribe(doctype, name)
    $socket?.on('doc_viewers', onViewers)
    $socket?.on('authoring_editor', onEditor)
  })

  onBeforeUnmount(() => {
    if (editing()) mark('stop_editing')
    $socket?.off('doc_viewers', onViewers)
    $socket?.off('authoring_editor', onEditor)
    docUnsubscribe(doctype, name)
    docClose(doctype, name)
  })

  return { viewers, editor, warnIfTaken }
}
