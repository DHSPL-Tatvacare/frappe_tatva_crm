<!--
  TATVA: Smart Views — the read-only grain surface (P1). A LayoutHeader with ViewBreadcrumbs, then the
  view switcher (DESKTOP: SmartViewTabs fixed-width strip; MOBILE/PWA: SmartViewSheet bottom sheet),
  over a single SmartViewList re-keyed to the active view. Selection lives in the route
  (/smart-views/:view) so views are deep-linkable. Row clicks bubble up here: a Lead-view row opens the
  Lead page; an Activity-view row opens the native activity/task modal (same showTask path as the
  global Tasks list — config-driven TatvaTaskModal, falling back to the generic doctype modal). No
  authoring here (that is P2); pure presentation.
-->
<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs routeName="SmartViews" />
    </template>
  </LayoutHeader>

  <div class="flex flex-1 flex-col overflow-hidden">
    <div
      v-if="!store.loaded && store.views.loading"
      class="flex flex-1 items-center justify-center text-sm text-ink-gray-5"
    >
      {{ __('Loading…') }}
    </div>
    <div
      v-else-if="!views.length"
      class="flex flex-1 items-center justify-center text-sm text-ink-gray-5"
    >
      {{ __('No Smart Views available.') }}
    </div>
    <template v-else>
      <div class="shrink-0">
        <SmartViewSheet
          v-if="isMobileView"
          :views="views"
          v-model="activeView"
          @create="onCreateView"
        />
        <SmartViewTabs
          v-else
          :views="views"
          v-model="activeView"
          @create="onCreateView"
        />
      </div>
      <SmartViewList
        v-if="activeView"
        ref="listRef"
        :key="activeView"
        :viewName="activeView"
        :baseObject="activeBaseObject"
        class="flex-1"
        @openLead="openLead"
        @openTask="openTask"
      />
    </template>
  </div>

  <!-- TATVA: config-driven modal for activity rows (same renderer as the global Tasks list). -->
  <TatvaTaskModal
    v-model="tcModalOpen"
    :task="tcTask"
    :config="tcConfig"
    :lead="tcLead"
    :map-config="
      tcMapCfg.data || {
        thumbnail: 'osm',
        dialog: 'google',
        zoom: 16,
        tile_url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      }
    "
    mode="view"
    @saved="listRef?.reload()"
  />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import SmartViewTabs from '@/tatva/SmartViewTabs.vue'
import SmartViewSheet from '@/tatva/SmartViewSheet.vue'
import SmartViewList from '@/tatva/SmartViewList.vue'
import TatvaTaskModal from '@/tatva/TatvaTaskModal.vue'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { isMobileView } from '@/composables/settings'
import { smartViewsStore } from '@/stores/smartViews'
import { call, createResource, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const store = smartViewsStore()

const listRef = ref(null)

const views = computed(() => store.views.data || [])

// The active view name = the :view route param, defaulting to the first tab once loaded.
const activeView = computed({
  get() {
    const param = route.params.view
    if (param && views.value.some((v) => v.name === param)) return param
    return views.value[0]?.name || ''
  },
  set(name) {
    if (name && name !== route.params.view) {
      router.replace({ name: 'SmartViews', params: { view: name } })
    }
  },
})

const activeBaseObject = computed(
  () => store.getView(activeView.value)?.base_object || 'Lead',
)

// Once the tabs load, pin a clean URL on the default landing (no :view -> first tab).
watch(
  [() => store.loaded, views],
  () => {
    if (store.loaded && views.value.length && !route.params.view) {
      router.replace({ name: 'SmartViews', params: { view: views.value[0].name } })
    }
  },
  { immediate: true },
)

// The "+" add-view action. Authoring (the stepper) is P2; until then this is an honest placeholder.
function onCreateView() {
  toast.info(__('Creating a Smart View comes with the authoring step (next phase).'))
}

// ---- row navigation -------------------------------------------------------
function openLead(leadId) {
  if (leadId) router.push({ name: 'Lead', params: { leadId } })
}

// The config-driven activity modal (mirrors pages/Tasks.vue showTask): ask the backend for the task's
// config; if it is an activity task, open our renderer, else fall back to the generic doctype modal.
const { showModal } = useDoctypeModal()
const tcMapCfg = createResource({
  url: 'tatva_connect.location.api.map_config',
  auto: true,
})
const tcModalOpen = ref(false)
const tcTask = ref(null)
const tcConfig = ref(null)
const tcLead = ref('')

async function openTask(name) {
  try {
    const d = await call('tatva_connect.activity.api.task_detail', { task: name })
    if (d && d.config) {
      tcTask.value = d.task
      tcConfig.value = d.config
      tcLead.value = d.lead || ''
      tcModalOpen.value = true
      return
    }
  } catch (e) {
    // fall through to the native modal on any error
  }
  showModal({
    name,
    doctype: 'CRM Task',
    title: 'Task',
    callbacks: { afterUpdate: () => listRef.value?.reload() },
  })
}
</script>
