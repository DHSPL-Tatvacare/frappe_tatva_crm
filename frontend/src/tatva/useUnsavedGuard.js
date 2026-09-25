// TATVA: ONE guard for unsaved work on an editing page — the browser's prompt on refresh/close and one dialog on an in-app leave.
import { createDialog } from '@/utils/dialogs'
import { onMounted, onUnmounted } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

// `isDirty()` answers whether work would be lost; `message` names the thing; `forget()` drops the edits before a confirmed leave.
export function useUnsavedGuard({ isDirty, message, forget }) {
  const router = useRouter()

  // ONE question however the author leaves — routed away or dropping the edits in place.
  function confirmDiscard(onDiscard) {
    createDialog({
      title: __('Leave without saving?'),
      message,
      actions: [
        {
          label: __('Discard changes'),
          variant: 'solid',
          theme: 'red',
          onClick: (close) => {
            close()
            onDiscard()
          },
        },
      ],
    })
  }

  // Refresh and tab-close use the browser's own prompt — the only thing that can block them.
  function beforeUnloadHandler(event) {
    if (!isDirty()) return
    event.preventDefault()
    event.returnValue = true
  }
  onMounted(() => addEventListener('beforeunload', beforeUnloadHandler))
  onUnmounted(() => removeEventListener('beforeunload', beforeUnloadHandler))

  // Refuse and let Discard re-issue it: createDialog has no dismiss callback, so holding `next` hangs.
  onBeforeRouteLeave((to) => {
    if (!isDirty()) return true
    confirmDiscard(() => {
      forget()
      router.push(to.fullPath)
    })
    return false
  })

  return { confirmDiscard }
}
