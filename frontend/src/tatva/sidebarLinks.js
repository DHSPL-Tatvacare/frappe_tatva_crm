// TATVA: the sidebar's nav list, read by AppSidebar and the ⌘K palette's Navigate group, so labels, icons and gates cannot drift.
import LucideLayoutDashboard from '~icons/lucide/layout-dashboard'
import LucideMapPin from '~icons/lucide/map-pin'
import LucideTable2 from '~icons/lucide/table-2'
import LucideWorkflow from '~icons/lucide/workflow'
import LucideClipboardPenLine from '~icons/lucide/clipboard-pen-line'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import ContactsIcon from '@/components/Icons/ContactsIcon.vue'
import OrganizationsIcon from '@/components/Icons/OrganizationsIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import { surfaces } from '@/composables/surfaces'

export const sidebarLinks = [
  {
    label: 'Dashboard',
    icon: LucideLayoutDashboard,
    to: 'Dashboard',
  },
  {
    label: 'Leads',
    icon: LeadsIcon,
    to: 'Leads',
  },
  // TATVA: Deals — gated on the same rule as every other surface (a line armed for deals, and permission).
  {
    label: 'Deals',
    icon: DealsIcon,
    to: 'Deals',
    condition: () => surfaces.deals,
  },
  // TATVA: Contacts and Organizations exist to be sold to, so they ride the same gate as Deals.
  {
    label: 'Contacts',
    icon: ContactsIcon,
    to: 'Contacts',
    condition: () => surfaces.contacts,
  },
  {
    label: 'Organizations',
    icon: OrganizationsIcon,
    to: 'Organizations',
    condition: () => surfaces.organizations,
  },
  {
    label: 'Notes',
    icon: NoteIcon,
    to: 'Notes',
  },
  {
    label: 'Tasks',
    icon: TaskIcon,
    to: 'Tasks',
  },
  {
    label: 'Call Logs',
    icon: PhoneIcon,
    to: 'Call Logs',
  },
  // TATVA: Near Me — gated; renders only when the server grants access (stock CRM unaffected).
  {
    label: 'Near Me',
    icon: LucideMapPin,
    to: 'NearMe',
    condition: () => surfaces.near_me,
  },
  // TATVA: Smart Views — universal surface, always shown (grain entitlement is server-side, per view).
  {
    label: 'Smart Views',
    icon: LucideTable2,
    to: 'SmartViews',
  },
  // TATVA: Task Forms — the CRM Task Type builder, behind the same authoring gate as Workflows; desktop only.
  {
    label: 'Task Forms',
    icon: LucideClipboardPenLine,
    to: 'Task Forms',
    condition: () => surfaces.workflows,
  },
  // TATVA: Workflows — orchestration flows, last in the list. Gated on the SAME server rule that authorises the page.
  {
    label: 'Workflows',
    icon: LucideWorkflow,
    to: 'Workflows',
    condition: () => surfaces.workflows,
  },
]
