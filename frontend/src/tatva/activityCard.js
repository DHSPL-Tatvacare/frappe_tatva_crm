// The activity-card adapters' shared helpers. `oneLine` collapses a rich body to one clean line for the
// flavor slot; `actorFor` is the ONE automation-attribution resolver (so every surface reads a stamped
// row the same way); `fileCard` maps a File → the four-slot card shape and is shared by the Attachments
// tab AND the Activity rail (one File shape, two surfaces — one adapter).
import { markRaw } from 'vue'
import { htmlToText, convertSize, isImage, formatDate } from '@/utils'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import LucideWorkflow from '~icons/lucide/workflow'
import { statusTheme } from '@/tatva/taskStatus.js'
import { dueBadge } from '@/tatva/taskDue.js'

export function oneLine(value) {
  if (!value) return ''
  const text = /<[a-z][\s\S]*>/i.test(value) ? htmlToText(value) : String(value)
  return text.replace(/\s+/g, ' ').trim()
}

const WORKFLOW_ICON = markRaw(LucideWorkflow)

// Attribution for a card/rail row. A backend-stamped automation row (get_activities attaches `automation
// = {label, run}`) reads "Workflow: {label}" with the workflow glyph and deep-links to the lead's Workflow
// tab; otherwise the human owner passed in. ONE resolver — every adapter (note/task/attachment/rail)
// attributes alike, and an unstamped row is the human owner exactly as today.
// TATVA: when a card/rail row happened — ONE absolute format, because relative time hides a record's history: `prettyDate` returns a flat "1 year ago" for everything 365-729 days old, so Apr 2025 and Aug 2024 read identically.
export const whenLabel = (value) =>
  value ? formatDate(value, 'D MMM YYYY, h:mm a') : ''

// One save's header — set (no before), changed, or updated (both) — for the Lead rail and every History view alike.
export function saveVerb(changes) {
  const n = changes.length
  const set = changes.filter((c) => !c.from).length
  if (n === 1) return set ? __('set a field') : __('changed a field')
  return set === n
    ? __('set {0} fields', [n])
    : set === 0
      ? __('changed {0} fields', [n])
      : __('updated {0} fields', [n])
}

// `automation` is the row's resolved origin, or plain true where the row proves the engine acted but carries no workflow NAME — attributed as automation rather than invented one.
export function actorFor(automation, human) {
  if (!automation) return human
  return {
    label: automation.label
      ? __('Workflow: {0}', [automation.label])
      : __('Automation'),
    iconComp: WORKFLOW_ICON,
    to: { hash: '#Workflow' },
  }
}

// The surface a file arrived through, as the same icon that labels that surface elsewhere. Blank = filed on the lead.
const SOURCE_ICONS = markRaw({
  Comment: CommentIcon,
  Note: NoteIcon,
  Task: TaskIcon,
  Email: EmailIcon,
  WhatsApp: WhatsAppIcon,
})
const CLIP = markRaw(AttachmentIcon) // one attachment icon for every non-image file — matches the spotlight search, distinct from Notes

// A file whose URL points at another host — we never held its bytes, so it is neither stored nor screened.
const isExternal = (file) => /^https?:\/\//.test(file.file_url || '')

function reviewBadge(status) {
  if (!status) return null
  const theme =
    status === 'Approved' ? 'green' : status === 'Rejected' ? 'red' : 'gray'
  return { label: __(status), theme }
}

// A File → the four-slot card shape. An image gets a thumbnail via the tile; others a file-type icon.
// The flavor line is `TYPE · size · from {source}`; source + privacy are icon-only CORNER indicators.
export function fileCard(file, getUser) {
  const who = getUser(file.owner)
  const corner = []
  if (SOURCE_ICONS[file.source])
    corner.push({
      iconComp: SOURCE_ICONS[file.source],
      tooltip: __('Added on {0}', [__(file.source)]),
    })
  corner.push(
    isExternal(file)
      ? {
          icon: 'link',
          tooltip: __('External link — not stored or screened by us'),
        }
      : file.is_private
        ? { icon: 'lock', tooltip: __('Private') }
        : { icon: 'unlock', tooltip: __('Public') },
  )
  const shortType = (
    file.file_type ||
    (file.file_name || '').split('.').pop() ||
    ''
  )
    .split('/')
    .pop()
    .toUpperCase()
  const source = file.source ? __('from {0}', [__(file.source)]) : ''
  const tile = isImage(file.file_type)
    ? { kind: 'thumb', src: file.file_url }
    : // Neutral, matching the spotlight tiles (2026-07-31): a type is read from its icon, and colour is
      // reserved for the one thing that carries a meaning — the stage.
      { kind: 'icon', icon: CLIP, tint: 'gray' }
  return {
    tile,
    title: file.file_name,
    badge: reviewBadge(file.custom_review_status),
    flavor: [shortType, convertSize(file.file_size), source]
      .filter(Boolean)
      .join(' · '),
    corner,
    actor: { label: who.full_name, image: who.user_image },
    at: file.creation,
    menu: [{ label: __('Delete Attachment'), icon: 'trash-2', key: 'delete' }],
  }
}

// TATVA: the ONE actor reader — the server named it once for the page (api/activities._name_actors); only a person owns an avatar.
export function sender(row, getUser) {
  const who = row.owner_kind === 'person' ? getUser(row.owner) : null
  return {
    label: row.owner_name || who?.full_name || row.owner || '',
    image: who?.user_image || '',
  }
}

// A FCRM Note → the four-slot card shape; `who` is the human author the caller resolved. Shared by the Notes tab and Near Me.
export function noteCard(note, who) {
  const body = oneLine(note.content)
  return {
    tile: { kind: 'icon', icon: markRaw(NoteIcon), tint: 'green' },
    title: note.title || body || __('Untitled note'),
    flavor: note.title ? body : '',
    corner: note.attachments
      ? [
          {
            icon: 'paperclip',
            tooltip: __('{0} attachment(s)', [note.attachments]),
          },
        ]
      : [],
    actor: actorFor(note.automation, who),
    at: note.creation, // TATVA: when it was written — the time the list is ordered by
    menu: [{ label: __('Delete'), icon: 'trash-2', key: 'delete' }],
  }
}

// A `lead_activity` task row (server-annotated: due, rep, location, attachments) → the card shape. Shared by the Tasks board and Near Me.
export function taskCard(task) {
  const done = task.status === 'Done' || task.status === 'Canceled'
  const corner = []
  if (task.location)
    corner.push({ icon: 'map-pin', tooltip: __('Location captured') })
  if (task.attachments)
    corner.push({
      icon: 'paperclip',
      tooltip: __('{0} attachment(s)', [task.attachments]),
    })
  const completion = task.completed_on
    ? `${__('Completed')} ${task.completed_on}${task.completed_by ? ' · ' + task.completed_by : ''}`
    : ''
  return {
    title: task.title,
    // Closed → its status; open → its Task Status.
    badge: done
      ? { label: task.status, theme: statusTheme(task.status) }
      : dueBadge(task),
    flavor: done
      ? completion
      : [task.due, task.priority].filter(Boolean).join(' · '),
    corner,
    // The same overflow the note and attachment cards carry; the status half lives in the tile above.
    menu: [{ label: __('Delete'), icon: 'trash-2', key: 'delete' }],
    actor: actorFor(task.automation, {
      label: task.rep_name,
      image: task.rep_image,
    }),
    at: task.creation,
    dimmed: false, // TATVA: the Done badge already says the state; fading the row just made history hard to read.
  }
}
