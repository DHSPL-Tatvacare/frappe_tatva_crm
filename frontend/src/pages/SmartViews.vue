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
          @edit="onEditView"
        />
        <SmartViewTabs
          v-else
          :views="views"
          v-model="activeView"
          @create="onCreateView"
          @edit="onEditView"
        />
      </div>
      <!-- No :key here: the whole page already remounts on any view change (App.vue keys
           router-view on $route.fullPath, and the active view IS a route param). A second key
           on the list would remount it a second time on the same navigation → double get_data
           (seen on create, where store.views.reload() splits the route change across ticks). -->
      <SmartViewList
        v-if="activeView"
        ref="listRef"
        :viewName="activeView"
        :baseObject="activeBaseObject"
        :canEdit="activeCanEdit"
        class="flex-1"
        @openLead="openLead"
        @openTask="openTask"
        @editView="onEditView(activeView)"
      />
    </template>
  </div>

  <!-- TATVA: authoring drawer (create/edit/delete) — reuses native Filter + ColumnSettings. -->
  <SmartViewEditor
    v-model="editorOpen"
    :viewName="editorViewName"
    @saved="onEditorSaved"
    @deleted="onEditorDeleted"
  />

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
import SmartViewEditor from '@/tatva/SmartViewEditor.vue'
import TatvaTaskModal from '@/tatva/TatvaTaskModal.vue'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { isMobileView } from '@/composables/settings'
import { smartViewsStore } from '@/stores/smartViews'
import { call, createResource } from 'frappe-ui'
import { computed, ref } from 'vue'
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
const activeCanEdit = computed(() => !!store.getView(activeView.value)?.can_write)
// No on-load URL rewrite: the getter already defaults to the first view. The router-view is keyed on
// $route.fullPath (App.vue), so redirecting on mount would remount the page and double-fetch — the way
// native pages work is to remount only on a real tab navigation (one get_data per view, via the setter).

// ---- authoring (create / edit / delete) -----------------------------------
const editorOpen = ref(false)
const editorViewName = ref('')

function onCreateView() {
  editorViewName.value = ''
  editorOpen.value = true
}
function onEditView(name) {
  editorViewName.value = name
  editorOpen.value = true
}
async function onEditorSaved(tab) {
  // Refresh the tab row (label/scope may have changed).
  await store.views.reload()
  if (!tab?.name) return
  if (tab.name !== activeView.value) {
    // A newly created view (or a switch): navigate → route change → page remount → 1× fetch.
    activeView.value = tab.name
  } else {
    // Edited the ALREADY-active view: the route doesn't change, so the page won't remount — reload the
    // list in place so the new predicate/columns take effect (without this it shows stale columns).
    listRef.value?.reload()
  }
}
async function onEditorDeleted(name) {
  await store.views.reload()
  if (activeView.value === name || !views.value.some((v) => v.name === activeView.value)) {
    const first = views.value[0]?.name || ''
    if (first) activeView.value = first
  }
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
