// TATVA: the palette's global rows, Helpdesk's `commands.ts`: the screen's own rows, then Recent, Navigate, Create and Account.
import router from '@/router'
import { activeSettingsPage, isMobileView, showSettings } from '@/composables/settings'
import { wasDeleted } from '@/stores/bulkActionsPanel'
import { sessionStore } from '@/stores/session'
import { theme, toggleTheme } from '@/stores/theme'
import { useCheckin } from '@/tatva/checkin/useCheckin'
import { SHORTCUTS, showShortcuts } from '@/tatva/shortcuts'
import { sidebarLinks } from '@/tatva/sidebarLinks'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import LucideActivity from '~icons/lucide/activity'
import LucideBookmark from '~icons/lucide/bookmark'
import LucideKeyboard from '~icons/lucide/keyboard'
import LucideLogOut from '~icons/lucide/log-out'
import LucideMoon from '~icons/lucide/moon'
import LucidePlus from '~icons/lucide/plus'
import LucideSettings from '~icons/lucide/settings'
import LucideSun from '~icons/lucide/sun'
import { listCommands } from './listCommands'
import { allNamedCommands, dashboardCommands, namedCommands, smartViewCommands } from './namedCommands'
import { GROUP, NAV_WEIGHT } from './paletteTypes'
import { queryRootCommands } from './queryCommands'
import { newLeadAsked, settingsTabs as publishedTabs } from './published'
import { recentLeads } from './recentLeads'

// The modal's tabs computed, unwrapped; null until the desktop modal has mounted.
const settingsTabs = () => publishedTabs.value?.value || null

// Extra root rows per route. Values stay lazy: they read what the mounted screen published.
const routeCommands = {
  Leads: () => listCommands('CRM Lead'),
  Deals: () => listCommands('CRM Deal'),
  Tasks: () => listCommands('CRM Task'),
  SmartViews: smartViewCommands,
  Dashboard: dashboardCommands,
}

// The global list. The open lead's actions live behind the context chip, not here.
export function buildRootCommands(query) {
  const route = router.currentRoute.value
  return [
    ...(routeCommands[String(route.name ?? '')]?.() ?? []),
    ...(query ? [] : recentLeadCommands()),
    ...namedCommands(),
    // The query builder is desktop only: a phone's ⌘K never offers it.
    ...(isMobileView.value ? [] : queryRootCommands()),
    ...navigateCommands(),
    ...createCommands(),
    browseNamedCommand(),
    ...accountCommands(),
  ]
}

export function recentLeadCommands() {
  const openLead = String(router.currentRoute.value.params.leadId ?? '')
  return recentLeads()
    // The open lead, and one this tab saw deleted (the store's own record); one deleted elsewhere leaves when it fails to open.
    .value.filter((lead) => lead.name !== openLead && !wasDeleted('CRM Lead', lead.name))
    .map((lead) => ({
      id: `recent-lead-${lead.name}`,
      title: lead.title,
      group: GROUP.recent,
      icon: LeadsIcon,
      perform: () => router.push({ name: 'Lead', params: { leadId: lead.name } }),
    }))
}

// The sidebar's own list and gates, so a link the sidebar hides never shows here.
function navigateCommands() {
  return sidebarLinks
    .filter((link) => !link.condition || link.condition())
    .map((link) => ({
      id: `go-${link.to}`,
      title: __(link.label),
      group: GROUP.navigate,
      icon: link.icon,
      weight: NAV_WEIGHT,
      perform: () => router.push({ name: link.to }),
    }))
}

// The Leads page owns its form and its grain pick; the palette only asks it to open.
function createCommands() {
  return [
    {
      id: 'new-lead',
      title: __('New lead'),
      group: GROUP.create,
      icon: LucidePlus,
      keywords: 'create add patient',
      perform: () => {
        newLeadAsked.value = true
        if (router.currentRoute.value.name !== 'Leads') router.push({ name: 'Leads' })
      },
    },
  ]
}

// One row above Account that opens every smart view, saved view, workflow, workspace and dashboard; each still answers when typed.
function browseNamedCommand() {
  return {
    id: 'browse-shortcuts',
    title: __('Shortcuts'),
    group: GROUP.create,
    icon: LucideBookmark,
    keywords: 'smart views saved views workflows workspaces dashboards insights',
    // A live level, so the list fills in if the store is still answering when the row is opened.
    children: () => allNamedCommands,
  }
}

function accountCommands() {
  const checkin = useCheckin()
  const desktop = !isMobileView.value
  return [
    {
      id: 'toggle-theme',
      title: __('Toggle theme'),
      group: GROUP.account,
      icon: theme.value === 'dark' ? LucideSun : LucideMoon,
      keywords: 'dark light appearance',
      perform: toggleTheme,
    },
    ...(checkin.checkinMenuItem.value
      ? [
          {
            id: 'availability',
            title: __('Set availability'),
            subtitle: checkin.checkinMenuItem.value.label,
            group: GROUP.account,
            icon: LucideActivity,
            keywords: 'my status presence check in active away unavailable',
            children: () => availabilityChildren(checkin),
          },
        ]
      : []),
    settingsCommand(),
    ...(desktop
      ? [
          {
            id: 'shortcuts',
            title: __('Keyboard shortcuts'),
            group: GROUP.account,
            icon: LucideKeyboard,
            hint: SHORTCUTS.shortcuts.keys,
            keywords: 'keys hotkeys bindings help',
            perform: () => (showShortcuts.value = true),
          },
        ]
      : []),
    {
      id: 'logout',
      title: __('Log out'),
      group: GROUP.account,
      icon: LucideLogOut,
      keywords: 'sign out exit',
      // The user menu's own path: a checked-in rep is asked about checking out first.
      perform: () => checkin.logoutWithCheckout(() => sessionStore().logout.submit()),
    },
  ]
}

// The user menu's own status list, ticking the one in effect.
function availabilityChildren(checkin) {
  return checkin.checkinMenuItem.value.submenu.map((item) => ({
    id: `availability-${item.label}`,
    title: item.label,
    group: 'Set availability',
    icon: item.icon,
    checked: item.label === checkin.checkinMenuItem.value.label,
    perform: item.onClick,
  }))
}

// A drill-down of the desktop modal's own permission-filtered tabs; a phone's sheet has no tabs to name, so it just opens.
function settingsCommand() {
  const base = {
    id: 'settings',
    title: __('Settings'),
    group: GROUP.account,
    icon: LucideSettings,
    hint: SHORTCUTS.settings.keys,
    keywords: 'preferences profile notifications users email telephony whatsapp',
  }
  if (!settingsTabs()) return { ...base, perform: () => (showSettings.value = true) }
  return {
    ...base,
    children: () =>
      settingsTabs().flatMap((section) =>
        section.items.map((item) => ({
          id: `settings-${item.label}`,
          title: item.label,
          group: section.label,
          icon: item.icon,
          perform: () => {
            activeSettingsPage.value = item.label
            showSettings.value = true
          },
        })),
      ),
  }
}

