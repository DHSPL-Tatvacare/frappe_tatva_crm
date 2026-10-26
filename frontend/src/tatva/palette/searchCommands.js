// TATVA: server search hits as palette rows, Helpdesk's `searchCommands.ts` with the CRM's record line: a lead's number and grain, a file's owner.
import router from '@/router'
import { call } from 'frappe-ui'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import LucideList from '~icons/lucide/list'
import { grainLabel } from '@/tatva/useEntitledGrains'
import { stripTags, titleRuns } from './paletteTypes'

export const SEARCH_URL = 'tatva_connect.search.api.search'
// Frappe's own ceiling (`sqlite_search.MAX_SEARCH_RESULTS`); the server clamps to it.
const ALL_ROWS = 100

// One heading per kind the server returns, in the order it ranks them; an unknown kind degrades to a plain row.
const TYPE = {
  'CRM Lead': { icon: LeadsIcon, group: 'Leads' },
  'CRM Deal': { icon: DealsIcon, group: 'Deals' },
  'FCRM Note': { icon: NoteIcon, group: 'Notes' },
  File: { icon: AttachmentIcon, group: 'Attachments' },
}
const FALLBACK = { icon: LucideList, group: 'Other' }

const plain = (text, extra) => ({ runs: [{ text, match: false }], ...extra })
const marked = (text) => ({ runs: [{ text, match: true }] })

// A lead's number, then its grain as one path — or, when the server says an ID was typed, that ID in its place.
function leadMeta(hit) {
  const ident = hit.ident || null
  const grain = hit.vertical || hit.group || hit.program ? grainLabel(hit) : ''
  const placed =
    ident && ident.column !== 'phone'
      ? { label: ident.label, ...marked(ident.value) }
      : grain && plain(grain)
  const phone = hit.phone && (ident?.column === 'phone' ? marked(hit.phone) : plain(hit.phone))
  return [phone, placed].filter(Boolean)
}

// A file is titled by its own name and says whose it is: the patient, weighted, then their number.
function fileMeta(hit) {
  return [hit.lead_name && plain(hit.lead_name, { strong: true }), hit.phone && plain(hit.phone)].filter(Boolean)
}

function metaOf(hit) {
  if (hit.doctype === 'CRM Lead') return leadMeta(hit)
  if (hit.doctype === 'File') return fileMeta(hit)
  // A lead ignores `snippet` (identifiers); every other row shows the server's own highlighted excerpt.
  return hit.snippet ? [{ runs: titleRuns(hit.snippet) }] : []
}

// A Deal is its own record; a File opens its bytes; everything else is a lead and its tab.
function open(hit) {
  if (hit.doctype === 'CRM Deal') return hit.name && router.push({ name: 'Deal', params: { dealId: hit.name } })
  if (hit.doctype === 'File' && hit.file_url) return window.open(hit.file_url, '_blank', 'noopener')
  const tab = hit.doctype === 'File' ? 'attachments' : hit.tab
  if (hit.lead) router.push({ name: 'Lead', params: { leadId: hit.lead }, hash: tab ? '#' + tab : undefined })
}

function hitCommand(hit, index, group) {
  return {
    id: `search-${hit.doctype}-${hit.name}`,
    title: stripTags(hit.title || hit.name),
    marked: hit.title || hit.name,
    meta: metaOf(hit),
    badge: hit.doctype === 'CRM Lead' ? hit.stage || '' : '',
    icon: (TYPE[hit.doctype] || FALLBACK).icon,
    group,
    // Server order is relevance order; it is never re-scored here.
    rank: 950 - index,
    perform: () => open(hit),
  }
}

// The root's preview: five per kind, then a "Show all" row that drills into every row of that kind.
export function searchCommands(response, term) {
  const totals = response?.totals || {}
  const out = []
  let run = null
  let shown = 0
  const closeRun = () => {
    const total = totals[run] || 0
    // A capped search counts each kind from the rows it kept, so every count is then a floor — `100+`, as the footer says.
    if (run && total > shown) out.push(showAll(run, `${total}${response.total_capped ? '+' : ''}`, term, out.length))
  }
  for (const hit of response?.results || []) {
    if (hit.doctype !== run) {
      closeRun()
      run = hit.doctype
      shown = 0
    }
    shown++
    out.push(hitCommand(hit, out.length, (TYPE[hit.doctype] || FALLBACK).group))
  }
  closeRun()
  return out
}

function showAll(doctype, total, term, index) {
  return {
    id: `search-all-${doctype}`,
    title: __('Show all {0}', [total]),
    group: (TYPE[doctype] || FALLBACK).group,
    // The breadcrumb names the kind, not the count.
    levelTitle: (TYPE[doctype] || FALLBACK).group,
    rank: 950 - index,
    children: async () => {
      const response = await call(SEARCH_URL, { query: term, type: doctype, limit: ALL_ROWS })
      return (response?.results || []).map((hit, i) => hitCommand(hit, i, ''))
    },
  }
}
