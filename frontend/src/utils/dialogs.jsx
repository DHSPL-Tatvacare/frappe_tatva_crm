import { Dialog, ErrorMessage } from 'frappe-ui'
import { reactive, ref } from 'vue'

let dialogs = ref([])

export function isDialogOpen() {
  return dialogs.value.some((d) => d.show)
}

export let Dialogs = {
  name: 'Dialogs',
  render() {
    return dialogs.value.map((dialog) => (
      <Dialog
        options={dialog}
        modelValue={dialog.show}
        onUpdate:modelValue={(val) => (dialog.show = val)}
      >
        {{
          'body-content': () => {
            return [
              dialog.message && (
                <p class="text-p-base text-ink-gray-7">{dialog.message}</p>
              ),
              dialog.html && <div v-html={dialog.html} />,
              <ErrorMessage class="mt-2" message={dialog.error} />,
            ]
          },
        }}
      </Dialog>
    ))
  },
}

// TATVA: frappe-ui's Dialog hardcodes `class="w-full"` on every action button (Dialog.vue), so a
// one-action confirm rendered as a full-bleed primary bar — which reads as a page action, not as a
// choice. The class is neutralised HERE, once, for every createDialog in the app.
//
// Deliberately NOT done by rendering the actions ourselves in an #actions slot: frappe-ui wraps each
// action's onClick with its own loading state and the close context, and re-rendering them would
// silently drop both.
function autoWidthActions(dialogOptions) {
  const actions = dialogOptions?.actions
  if (!Array.isArray(actions)) return dialogOptions
  return {
    ...dialogOptions,
    actions: actions.map((action) => ({
      ...action,
      // `!` beats the hardcoded w-full; Vue merges the two class strings rather than replacing.
      class: [action.class, '!w-auto'].filter(Boolean).join(' '),
    })),
  }
}

export function createDialog(dialogOptions) {
  let dialog = reactive(autoWidthActions(dialogOptions))
  dialog.key = 'dialog-' + dialogs.value.length
  dialog.show = false
  setTimeout(() => {
    dialog.show = true
  }, 0)
  dialogs.value.push(dialog)
}
