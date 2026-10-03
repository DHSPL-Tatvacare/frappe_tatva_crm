// TATVA: the authoring lifecycle's verbs as Workflows and Task Forms both offer them: ask first, move through the server, show its verdict, Edit through a Revise.
import { createDialog } from '@/utils/dialogs'
import { call, toast } from 'frappe-ui'
import { ref } from 'vue'

// Edit's own move: a Revise that carries its own `done` line, since "Revise done" would name a verb no header says out loud.
export const REVISE = { action: 'revise', label: 'Edit', done: 'Back to a draft — edit, save, then publish again' }

// `method(action)` names the server verb, `name()` the record, `reload` re-reads it, `showVerdict` takes the server's problems, `retire(verb)` asks before a verb that stops something.
export function useLifecycle({ method, name, reload, showVerdict, retire }) {
  const moving = ref(null)

  // §4 — a lifecycle move is not undoable by a second click; it asks first, through the app's one host.
  function confirmMove(verb) {
    if (verb.retires && retire) return retire(verb)
    if (!verb.confirm) return move(verb)
    createDialog({
      title: __(verb.label),
      message: __(verb.confirm),
      actions: [
        {
          label: __(verb.label),
          variant: 'solid',
          onClick: (close) => {
            close()
            return move(verb)
          },
        },
      ],
    })
  }

  async function move(verb) {
    moving.value = verb.action
    try {
      const result = await call(method(verb.action), { name: name() })
      // A definition that is not ready comes back as DATA: the editor marks what it names and the toast is the backend's one-line directive.
      if (result && result.ok === false) {
        showVerdict(result)
        toast.error(__("Can't publish yet. {0}", [result.summary]))
        return false
      }
      // A publish can succeed AND carry warnings, which the header pill keeps; a clean move carries none and clears it.
      showVerdict(result)
      await reload()
      toast.success(verb.done ? __(verb.done) : __('{0} done', [__(verb.label)]))
      return true
    } catch (e) {
      const msgs = e?.messages?.length ? e.messages : [e?.message || __('That did not work')]
      msgs.forEach((m) => toast.error(m))
      return false
    } finally {
      moving.value = null
    }
  }

  // The overflow's groups, which is how the divider between them is drawn: what moves the record forward, then `middle`, then what stops it — a group with no verbs is absent rather than empty.
  function groups(verbs, middle, stopsLabel) {
    const item = (verb) => ({ label: __(verb.label), icon: verb.icon, onClick: () => confirmMove(verb) })
    const forward = verbs.filter((v) => !v.retires).map(item)
    const retiring = verbs.filter((v) => v.retires).map(item)
    return [
      forward.length && { group: __('Lifecycle'), hideLabel: true, items: forward },
      middle,
      retiring.length && { group: stopsLabel, items: retiring },
    ].filter(Boolean)
  }

  // ONE door into the editor: a Draft just opens, anything released goes back to Draft first, and that consequence is stated before it happens.
  function edit({ isDraft, title, message, revise, start }) {
    if (isDraft) return start()
    createDialog({
      title,
      message,
      actions: [
        {
          label: __('Edit'),
          variant: 'solid',
          onClick: async (close) => {
            close()
            if (await move(revise)) start()
          },
        },
      ],
    })
  }

  return { moving, move, confirmMove, groups, edit }
}
