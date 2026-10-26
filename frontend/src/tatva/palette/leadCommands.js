// TATVA: the open lead's rows, Helpdesk's `ticketCommands.ts`; every one runs the lead page's own path, so its checks and the server's stay the only ones.
import { copyToClipboard, parseColor } from '@/utils'
import { toast } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import { assignableUsers } from '@/tatva/useAssignableUsers'
import { isDeleting } from '@/stores/bulkActionsPanel'
import { useBulkJob } from '@/tatva/useBulkJob'
import { SHORTCUTS } from '@/tatva/shortcuts'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import LucideArrowLeft from '~icons/lucide/arrow-left'
import LucideArrowRight from '~icons/lucide/arrow-right'
import LucideCircleDot from '~icons/lucide/circle-dot'
import LucideCopy from '~icons/lucide/copy'
import LucideHandshake from '~icons/lucide/handshake'
import LucideLink from '~icons/lucide/link'
import LucidePanelsTopLeft from '~icons/lucide/panels-top-left'
import LucideUserPlus from '~icons/lucide/user-plus'
import LucideUserRoundCog from '~icons/lucide/user-round-cog'
import { CONTEXT_WEIGHT, FLAT_OPTION_WEIGHT, GROUP, loaded } from './paletteTypes'

const row = (extra) => ({ group: GROUP.lead, weight: CONTEXT_WEIGHT, ...extra })

// The stage pill's own list (already loaded for the header), ticking the stage the lead stands at.
function stageOptions(lead, extra) {
  const current = lead.stage()
  return lead.stages().map((s) => ({
    id: `stage-${s.name}`,
    title: s.display_label || s.stage,
    dotClass: parseColor(s.color || 'gray'),
    checked: s.name === current,
    // Picking the stage it already stands at closes quietly.
    perform: () => s.name !== current && lead.setStage(s.name),
    ...extra(s),
  }))
}

// The people the server says may own this lead, asked fresh, the ones on it ticked; `pick` decides what choosing one does.
async function peopleRows(lead, group, pick) {
  const people = await assignableUsers(lead.id).reload()
  const assigned = lead.assignees()
  return (people || []).map((user) => ({
    id: `${group}-${user.name}`,
    title: user.full_name || user.name,
    // full_name is often just the email; don't print it twice.
    subtitle: user.full_name && user.full_name !== user.name ? user.name : '',
    group,
    avatar: { image: user.user_image, label: user.full_name || user.name },
    checked: assigned.includes(user.name),
    perform: () => pick(user, assigned),
  }))
}

const already = (user) => toast.success(__('Already assigned to {0}', [user.full_name || user.name]))

// Assign adds, never replaces — the tick says which it will do.
const assignPick = (lead) => (user, assigned) =>
  assigned.includes(user.name) ? already(user) : lead.addAssignee(user.name)

// Reassign is the list's own Reassign on this one lead: the server clears and assigns in one transaction, so the lead is never left with nobody.
const reassignPick = (lead) => async (user, assigned) => {
  if (assigned.length === 1 && assigned[0] === user.name) return already(user)
  try {
    await useBulkJob().runOrQueue('Reassign', 'CRM Lead', [lead.id], { assign_to: [user.name] }, lead.refreshAssignees)
  } catch (error) {
    // Surfaced: the server's own reason, as the list's Reassign shows it.
    toast.error(error?.messages?.[0] || __('Could not reassign the lead.'))
  }
}

// Skips the drill-down; offered only to someone the lead may go to, and hidden once held — "Assign to" is the way back out.
function assignToMeCommand(lead) {
  const me = sessionStore().user
  if (!me || lead.assignees().includes(me) || !loaded(assignableUsers(lead.id))?.some((u) => u.name === me)) return []
  return [row({ id: 'lead-assign-me', title: __('Assign to me'), icon: LucideUserPlus, keywords: 'claim mine myself take', perform: () => lead.addAssignee(me) })]
}

// What a lead page still allows while its lead is being deleted: looking around and copying, never a change.
function readOnlyRows(lead) {
  return [
    row({
      id: 'lead-tab',
      title: __('Go to tab'),
      icon: LucidePanelsTopLeft,
      keywords: lead.tabs().map((t) => t.label).join(' '),
      children: () =>
        lead.tabs().map((tab, index) => ({
          id: `lead-tab-${tab.name}`,
          title: tab.label,
          group: 'Go to tab',
          icon: tab.icon,
          checked: index === lead.tabIndex(),
          perform: () => lead.goToTab(index),
        })),
    }),
    row({ id: 'lead-copy-id', title: __('Copy lead ID'), icon: LucideCopy, hint: SHORTCUTS.copyId.keys, perform: () => copyToClipboard(lead.id) }),
    row({ id: 'lead-copy-url', title: __('Copy lead link'), icon: LucideLink, hint: SHORTCUTS.copyUrl.keys, perform: () => copyToClipboard(window.location.href) }),
  ]
}

export function leadCommands(lead) {
  const [goToTab, ...copyRows] = readOnlyRows(lead)
  // The page greys itself out while its lead is queued for deletion, or shows an error when it did not load; the palette offers what is still allowed.
  if (lead.missing() || isDeleting('CRM Lead', lead.id)) return [goToTab, ...copyRows]
  // A page lends only the controls it has; a phone has no next/previous, call or email here.
  const next = lead.peek?.(1)
  const previous = lead.peek?.(-1)
  return [
    ...(lead.stages().length
      ? [
          row({
            id: 'lead-stage',
            title: __('Change stage'),
            icon: LucideCircleDot,
            hint: SHORTCUTS.stage.keys,
            keywords: 'status lifecycle',
            children: () => stageOptions(lead, () => ({ group: 'Set stage' })),
          }),
          // Every stage as a root row, so typing "follow" sets it without the picker; hidden until typed.
          ...stageOptions(lead, (s) => ({
            title: `${__('Set stage')}: ${s.display_label || s.stage}`,
            group: GROUP.lead,
            keywords: s.display_label || s.stage,
            hideWhenEmpty: true,
            weight: FLAT_OPTION_WEIGHT,
          })),
        ]
      : []),
    row({
      id: 'lead-assign',
      title: __('Assign to'),
      icon: LucideUserPlus,
      hint: SHORTCUTS.assign.keys,
      keywords: 'owner assignee rep',
      children: () => peopleRows(lead, 'Assign to', assignPick(lead)),
    }),
    // Only meaningful once someone holds the lead; until then Assign is the same act.
    ...(lead.assignees().length
      ? [
          row({
            id: 'lead-reassign',
            title: __('Reassign'),
            icon: LucideUserRoundCog,
            keywords: 'hand over transfer move change owner',
            children: () => peopleRows(lead, 'Reassign', reassignPick(lead)),
          }),
        ]
      : []),
    ...assignToMeCommand(lead),
    ...(lead.canCall?.() ? [row({ id: 'lead-call', title: __('Call'), icon: PhoneIcon, keywords: 'phone dial ring', perform: lead.call })] : []),
    ...(lead.canEmail?.() ? [row({ id: 'lead-email', title: __('Send email'), icon: EmailIcon, keywords: 'mail reply write', perform: lead.email })] : []),
    goToTab,
    ...(lead.canConvert()
      ? [row({ id: 'lead-convert', title: __('Convert to deal'), icon: LucideHandshake, keywords: 'deal won', perform: lead.convert })]
      : []),
    ...(next
      ? [row({ id: 'lead-next', title: __('Next lead'), subtitle: next.lead_name || next.name, icon: LucideArrowRight, hint: SHORTCUTS.nextLead.keys, perform: lead.next })]
      : []),
    ...(previous
      ? [row({ id: 'lead-previous', title: __('Previous lead'), subtitle: previous.lead_name || previous.name, icon: LucideArrowLeft, hint: SHORTCUTS.previousLead.keys, perform: lead.previous })]
      : []),
    ...copyRows,
  ]
}
