<template>
  <div
    class="relative flex h-full flex-col justify-between transition-all duration-300 ease-in-out"
    :class="isSidebarCollapsed ? 'w-12' : 'w-[220px]'"
  >
    <div class="p-2">
      <UserDropdown :isCollapsed="isSidebarCollapsed" />
    </div>
    <div class="flex-1 overflow-y-auto">
      <div class="flex flex-col">
        <SidebarLink
          id="global-search-btn"
          :label="__('Search')"
          :icon="'search'"
          :isCollapsed="isSidebarCollapsed"
          class="relative mx-2 my-[1.5px]"
          @click="() => (showGlobalSearch = true)"
        >
          <template #right>
            <!-- TATVA: the glyph was a hardcoded ⌘, which is a key Windows does not have; KeyboardShortcut draws ⌘ on a Mac and the word Ctrl everywhere else. -->
            <KeyboardShortcut v-if="!isSidebarCollapsed" meta bg>K</KeyboardShortcut>
          </template>
        </SidebarLink>
        <SidebarLink
          id="notifications-btn"
          :label="__('Notifications')"
          :icon="NotificationsIcon"
          :isCollapsed="isSidebarCollapsed"
          class="relative mx-2 my-[1.5px]"
          @click="() => toggleNotificationPanel()"
        >
          <template #right>
            <Badge
              v-if="!isSidebarCollapsed && unreadNotificationsCount"
              :label="unreadNotificationsCount"
              variant="subtle"
            />
            <div
              v-else-if="unreadNotificationsCount"
              class="absolute -left-1.5 top-1 z-20 h-[5px] w-[5px] translate-x-6 translate-y-1 rounded-full bg-surface-gray-6 ring-1 ring-white"
            />
          </template>
        </SidebarLink>
        <SidebarLink
          id="bulk-actions-btn"
          :label="__('Bulk Actions')"
          :icon="BulkActionsIcon"
          :isCollapsed="isSidebarCollapsed"
          class="relative mx-2 my-[1.5px]"
          @click="() => bulkActionsToggle()"
        >
          <template #right>
            <Badge
              v-if="!isSidebarCollapsed && runningCount"
              :label="runningCount"
              variant="subtle"
            />
            <div
              v-else-if="runningCount"
              class="absolute -left-1.5 top-1 z-20 h-[5px] w-[5px] translate-x-6 translate-y-1 rounded-full bg-surface-gray-6 ring-1 ring-white"
            />
          </template>
        </SidebarLink>
      </div>
      <div v-for="view in allViews" :key="view.label">
        <div class="mx-2 my-1.5" />
        <Section
          :label="view.name"
          :hideLabel="view.hideLabel"
          :opened="view.opened"
        >
          <template #header="{ opened, hide, toggle }">
            <div
              v-if="!hide"
              class="flex items-center cursor-pointer gap-1.5 text-base text-ink-gray-5 transition-all duration-300 ease-in-out"
              :class="
                isSidebarCollapsed
                  ? 'h-0 overflow-hidden opacity-0'
                  : 'px-4 pt-[11px] pb-2.5 w-auto opacity-100'
              "
              @click="toggle()"
            >
              <FeatherIcon
                name="chevron-right"
                class="h-4 text-ink-gray-9 transition-all duration-300 ease-in-out"
                :class="{ 'rotate-90': opened }"
              />
              <span>{{ __(view.name) }}</span>
            </div>
          </template>
          <nav class="flex flex-col">
            <SidebarLink
              v-for="link in view.views"
              :key="link.label"
              :icon="link.icon"
              :label="__(link.label)"
              :to="link.to"
              :isCollapsed="isSidebarCollapsed"
              class="mx-2 my-[1.5px]"
            />
          </nav>
        </Section>
      </div>
    </div>
    <div class="m-2 flex flex-col gap-1">
      <div class="flex flex-col gap-2 mb-1">
        <SalesHierarchyBanner
          v-if="showSalesHierarchyBanner"
          :isSidebarCollapsed="isSidebarCollapsed"
        />
        <SignupBanner
          v-if="isDemoSite"
          :isSidebarCollapsed="isSidebarCollapsed"
          :afterSignup="() => capture('signup_from_demo_site')"
        />
        <TrialBanner
          v-if="isFCSite"
          :isSidebarCollapsed="isSidebarCollapsed"
          :afterUpgrade="() => capture('upgrade_plan_from_trial_banner')"
        />
        <GettingStartedBanner
          v-if="!isOnboardingStepsCompleted"
          :isSidebarCollapsed="isSidebarCollapsed"
        />
      </div>
      <SidebarLink
        v-if="isManager() && isDemoDataCreated"
        class="text-ink-red-3 hover:bg-surface-red-2 focus:bg-surface-red-2"
        :label="__('Clear Demo Data')"
        :isCollapsed="isSidebarCollapsed"
        @click="() => clearDemoData()"
      >
        <template #icon>
          <BrushCleaningIcon class="h-4 w-4" />
        </template>
      </SidebarLink>
      <SidebarLink
        v-if="isOnboardingStepsCompleted"
        :label="__('Help')"
        :isCollapsed="isSidebarCollapsed"
        @click="
          () => {
            showHelpModal = minimize ? true : !showHelpModal
            minimize = !showHelpModal
          }
        "
      >
        <template #icon>
          <HelpIcon class="h-4 w-4" />
        </template>
      </SidebarLink>
      <SidebarLink
        :label="isSidebarCollapsed ? __('Expand') : __('Collapse')"
        :isCollapsed="isSidebarCollapsed"
        class=""
        @click="isSidebarCollapsed = !isSidebarCollapsed"
      >
        <template #icon>
          <span class="grid h-4 w-4 flex-shrink-0 place-items-center">
            <CollapseSidebar
              class="h-4 w-4 text-ink-gray-7 duration-300 ease-in-out"
              :class="{ '[transform:rotateY(180deg)]': isSidebarCollapsed }"
            />
          </span>
        </template>
      </SidebarLink>
    </div>
    <Notifications />
    <Settings />
    <BulkActionsPanel />
    <HelpModal
      v-if="showHelpModal"
      v-model="showHelpModal"
      v-model:articles="articles"
      :logo="CRMLogo"
      :afterSkip="(step) => capture('onboarding_step_skipped_' + step)"
      :afterSkipAll="() => capture('onboarding_steps_skipped')"
      :afterReset="(step) => capture('onboarding_step_reset_' + step)"
      :afterResetAll="() => capture('onboarding_steps_reset')"
      :docsLink="helpDocsLink"
    />
    <IntermediateStepModal
      v-model="showIntermediateModal"
      :currentStep="currentStep"
    />
  </div>
</template>

<script setup>
import BrushCleaningIcon from '~icons/lucide/brush-cleaning'
import LucideLayoutDashboard from '~icons/lucide/layout-dashboard'
import LucideMapPin from '~icons/lucide/map-pin' // TATVA: Near Me sidebar icon
import LucideTable2 from '~icons/lucide/table-2' // TATVA: Smart Views — a data grid, not an app grid
import LucideWorkflow from '~icons/lucide/workflow' // TATVA: Workflows sidebar icon
import BulkActionsIcon from '~icons/lucide/list-checks'
import CRMLogo from '@/components/Icons/CRMLogo.vue'
import InviteIcon from '@/components/Icons/InviteIcon.vue'
import ConvertIcon from '@/components/Icons/ConvertIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import StepsIcon from '@/components/Icons/StepsIcon.vue'
import Section from '@/components/Section.vue'
import PinIcon from '@/components/Icons/PinIcon.vue'
import UserDropdown from '@/components/UserDropdown.vue'
import SquareAsterisk from '@/components/Icons/SquareAsterisk.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import ContactsIcon from '@/components/Icons/ContactsIcon.vue'
import OrganizationsIcon from '@/components/Icons/OrganizationsIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import CollapseSidebar from '@/components/Icons/CollapseSidebar.vue'
import NotificationsIcon from '@/components/Icons/NotificationsIcon.vue'
import HelpIcon from '@/components/Icons/HelpIcon.vue'
import SidebarLink from '@/components/SidebarLink.vue'
import KeyboardShortcut from '@/components/KeyboardShortcut.vue'
import { surfaces } from '@/composables/surfaces' // TATVA: the one surface gate, read off the boot payload
// TATVA: Smart Views is always visible (universal surface; entitlement is server-side, per view).
import Notifications from '@/components/Notifications.vue'
import Settings from '@/components/Settings/Settings.vue'
import BulkActionsPanel from '@/components/BulkActionsPanel.vue'
import SalesHierarchyBanner from '@/components/SalesHierarchyBanner.vue'
import { viewsStore } from '@/stores/views'
import {
  unreadNotificationsCount,
  notificationsStore,
} from '@/stores/notifications'
import { runningCount, bulkActionsPanelStore } from '@/stores/bulkActionsPanel'
import { usersStore } from '@/stores/users'
import { sessionStore } from '@/stores/session'
import {
  showSettings,
  activeSettingsPage,
  showGlobalSearch,
} from '@/composables/settings'
import { showChangePasswordModal } from '@/composables/modals'
import { useBroadcast } from '@/composables/useBroadcast.js'
import { FeatherIcon, call, createResource } from 'frappe-ui'
import {
  SignupBanner,
  TrialBanner,
  HelpModal,
  GettingStartedBanner,
  useOnboarding,
  showHelpModal,
  minimize,
  IntermediateStepModal,
  useTelemetry,
} from 'frappe-ui/frappe'
import router from '@/router'
import { useStorage } from '@vueuse/core'
import { useDemoData } from '@/composables/demoData'
import { ref, reactive, computed, watch, markRaw, onMounted } from 'vue'

const { getPinnedViews, getPublicViews } = viewsStore()
const { toggle: toggleNotificationPanel } = notificationsStore()
const { toggle: bulkActionsToggle } = bulkActionsPanelStore()
const { capture } = useTelemetry()
const { clearDemoData, isDemoDataCreated } = useDemoData()
const { send } = useBroadcast()

const isSidebarCollapsed = useStorage('isSidebarCollapsed', false)

const isFCSite = ref(window.is_fc_site)
const isDemoSite = ref(window.is_demo_site)
const showSalesHierarchyBanner = ref(!!window.show_sales_hierarchy_banner)

const links = [
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
  // TATVA: Workflows — orchestration flows. Gated on the SAME server rule that authorises the page.
  {
    label: 'Workflows',
    icon: LucideWorkflow,
    to: 'Workflows',
    condition: () => surfaces.workflows,
  },
]

const allViews = computed(() => {
  let _views = [
    {
      name: 'All Views',
      hideLabel: true,
      opened: true,
      views: links.filter((link) => {
        if (link.condition) {
          return link.condition()
        }
        return true
      }),
    },
  ]
  if (getPublicViews().length) {
    _views.push({
      name: 'Public Views',
      opened: true,
      views: parseView(getPublicViews()),
    })
  }

  if (getPinnedViews().length) {
    _views.push({
      name: 'Pinned Views',
      opened: true,
      views: parseView(getPinnedViews()),
    })
  }
  return _views
})

function parseView(views) {
  return views.map((view) => {
    return {
      label: view.label,
      icon: getIcon(view.route_name, view.icon),
      to: {
        name: view.route_name,
        params: { viewType: view.type || 'list' },
        query: { view: view.name },
      },
    }
  })
}

function getIcon(routeName, icon) {
  if (icon) return icon

  switch (routeName) {
    case 'Leads':
      return LeadsIcon
    case 'Deals':
      return DealsIcon
    case 'Contacts':
      return ContactsIcon
    case 'Organizations':
      return OrganizationsIcon
    case 'Notes':
      return NoteIcon
    case 'Call Logs':
      return PhoneIcon
    default:
      return PinIcon
  }
}

// onboarding
const { user } = sessionStore()
const { users, isManager } = usersStore()
const { isOnboardingStepsCompleted, setUp } = useOnboarding('frappecrm')

async function getFirstLead() {
  let firstLead = localStorage.getItem('firstLead' + user)
  if (firstLead) return firstLead
  return await call('crm.api.onboarding.get_first_lead')
}

async function getFirstDeal() {
  let firstDeal = localStorage.getItem('firstDeal' + user)
  if (firstDeal) return firstDeal
  return await call('crm.api.onboarding.get_first_deal')
}

const showIntermediateModal = ref(false)
const currentStep = ref({})

const steps = reactive([
  {
    name: 'setup_your_password',
    title: __('Setup your password'),
    icon: markRaw(SquareAsterisk),
    completed: false,
    onClick: () => {
      minimize.value = true
      showChangePasswordModal.value = true
      capture('onboarding_step_clicked_setup_password')
    },
  },
  {
    name: 'create_first_lead',
    title: __('Create your first lead'),
    icon: markRaw(LeadsIcon),
    completed: false,
    onClick: () => {
      minimize.value = true
      router.push({ name: 'Leads' })
      send('trigger_lead_create', true)
      capture('onboarding_step_clicked_create_first_lead')
    },
  },
  {
    name: 'invite_your_team',
    title: __('Invite your team'),
    icon: markRaw(InviteIcon),
    completed: false,
    onClick: () => {
      minimize.value = true
      showSettings.value = true
      activeSettingsPage.value = 'Invite User'
      capture('onboarding_step_clicked_invite_your_team')
    },
    condition: () => isManager(),
  },
  {
    name: 'convert_lead_to_deal',
    title: __('Convert lead to deal'),
    icon: markRaw(ConvertIcon),
    completed: false,
    dependsOn: 'create_first_lead',
    onClick: async () => {
      minimize.value = true
      capture('onboarding_step_clicked_convert_lead_to_deal')
      currentStep.value = {
        title: __('Convert lead to deal'),
        buttonLabel: __('Convert'),
        videoURL: '/assets/crm/videos/convertToDeal.mov',
        onClick: async () => {
          showIntermediateModal.value = false
          currentStep.value = {}

          let lead = await getFirstLead()
          if (lead) {
            router.push({ name: 'Lead', params: { leadId: lead } })
          } else {
            router.push({ name: 'Leads' })
          }
        },
      }
      showIntermediateModal.value = true
    },
  },
  {
    name: 'create_first_task',
    title: __('Create your first task'),
    icon: markRaw(TaskIcon),
    completed: false,
    onClick: async () => {
      minimize.value = true
      let deal = await getFirstDeal()
      capture('onboarding_step_clicked_create_first_task')

      if (deal) {
        router.push({
          name: 'Deal',
          params: { dealId: deal },
          hash: '#tasks',
        })
      } else {
        router.push({ name: 'Tasks' })
      }
    },
  },
  {
    name: 'create_first_note',
    title: __('Create your first note'),
    icon: markRaw(NoteIcon),
    completed: false,
    onClick: async () => {
      minimize.value = true
      let deal = await getFirstDeal()
      capture('onboarding_step_clicked_create_first_note')

      if (deal) {
        router.push({
          name: 'Deal',
          params: { dealId: deal },
          hash: '#notes',
        })
      } else {
        router.push({ name: 'Notes' })
      }
    },
  },
  {
    name: 'add_first_comment',
    title: __('Add your first comment'),
    icon: markRaw(CommentIcon),
    completed: false,
    dependsOn: 'create_first_lead',
    onClick: async () => {
      minimize.value = true
      let deal = await getFirstDeal()
      capture('onboarding_step_clicked_add_first_comment')

      if (deal) {
        router.push({
          name: 'Deal',
          params: { dealId: deal },
          hash: '#comments',
        })
      } else {
        router.push({ name: 'Leads' })
      }
    },
  },
  {
    name: 'send_first_email',
    title: __('Send email'),
    icon: markRaw(EmailIcon),
    completed: false,
    dependsOn: 'create_first_lead',
    onClick: async () => {
      minimize.value = true
      let deal = await getFirstDeal()
      capture('onboarding_step_clicked_send_first_email')

      if (deal) {
        router.push({
          name: 'Deal',
          params: { dealId: deal },
          hash: '#emails',
        })
      } else {
        router.push({ name: 'Leads' })
      }
    },
  },
  {
    name: 'change_deal_status',
    title: __('Change deal status'),
    icon: markRaw(StepsIcon),
    completed: false,
    dependsOn: 'convert_lead_to_deal',
    onClick: async () => {
      minimize.value = true
      capture('onboarding_step_clicked_change_deal_status')

      currentStep.value = {
        title: __('Change deal status'),
        buttonLabel: __('Change'),
        videoURL: '/assets/crm/videos/changeDealStatus.mov',
        onClick: async () => {
          showIntermediateModal.value = false
          currentStep.value = {}

          let deal = await getFirstDeal()
          if (deal) {
            router.push({
              name: 'Deal',
              params: { dealId: deal },
              hash: '#activity',
            })
          } else {
            router.push({ name: 'Leads' })
          }
        },
      }
      showIntermediateModal.value = true
    },
  },
])

onMounted(async () => {
  await users.promise

  const filteredSteps = steps.filter((step) => {
    if (step.condition) {
      return step.condition()
    }
    return true
  })

  setUp(filteredSteps)
})

// TATVA: the Help centre lists the handbook this site publishes, not the upstream product's public
// docs. The tree IS the wiki, read through one whitelisted endpoint and fenced by the reader's own
// space roles, so a section added, renamed or removed there is what the next open returns. Nothing is
// hardcoded, cached or copied, so there is nothing to keep in sync.
//
// ONE SPACE, not all of them. The panel builds every URL as `docsLink/name`, and uses `docsLink` alone
// for its "All articles" link. A prefix common to several spaces is only the site origin, which is not
// a handbook and lands wherever the site root happens to route. So the panel shows the reader's primary
// space: the first they may open, which is the handbook for a rep and stays the handbook for a manager.
// Everything else is one click away through the wiki's own space switcher.
const helpCenter = createResource({
  url: 'tatva_connect.api.help_center.tree',
  auto: true,
  // Never destructure the response: a failed or empty call would throw inside setup and take the
  // whole sidebar down with it, which shows up as a Help button that does nothing.
  transform: (data) => data?.spaces?.[0] || null,
})

const helpDocsLink = computed(() =>
  helpCenter.data ? `${window.location.origin}/${helpCenter.data.route}` : '',
)

// `v-model:articles` is a two-way binding the panel owns: it toggles `opened` on a section in place.
// So this is a real ref, filled when the tree arrives, never a computed. A page's `name` is its route
// relative to the space, because `docsLink` already carries the space.
const articles = ref([])

watch(
  () => helpCenter.data,
  (space) => {
    articles.value = (space?.sections || []).map((section) => ({
      title: section.title,
      opened: false,
      subArticles: section.pages.map((page) => ({
        name: page.route.slice(space.route.length + 1),
        title: page.title,
      })),
    }))
  },
  { immediate: true },
)
</script>
