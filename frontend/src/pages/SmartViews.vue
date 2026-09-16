<!-- TATVA: Smart Views page — view switcher (desktop tabs, mobile sheet) over one SmartViewList per active view; selection lives in the route so views deep-link, and row clicks open the Lead page or the native task modal. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs routeName="SmartViews" />
    </template>
    <template #right-header>
      <Button
        v-if="!isMobileView"
        variant="solid"
        :label="__('Create')"
        iconLeft="plus"
        :disabled="noGrains"
        @click="onCreateView"
      />
    </template>
  </LayoutHeader>

  <div class="flex flex-1 flex-col overflow-hidden">
    <div
      v-if="!store.loaded && store.views.loading"
      class="flex flex-1 items-center justify-center text-sm text-ink-gray-5"
    >
      {{ __('Loading…') }}
    </div>
    <!-- FAILED is its own state, never an empty state: a failed tab load must not read as "you have no views". -->
    <div
      v-else-if="!store.loaded && store.views.error"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-ink-gray-5"
    >
      <div>{{ __('Could not load your views.') }}</div>
      <Button :label="__('Retry')" @click="store.reload()" />
    </div>
    <!-- The server's view list is the only visibility verdict: entitlement may flavour the empty text but never hide views that exist. -->
    <div v-else-if="!views.length" class="flex flex-1 flex-col">
      <!-- width=lg: the default EmptyState width wraps this title on a phone. -->
      <EmptyState
        name="Smart Views"
        :title="noGrains ? __('No programme access yet') : __('No Smart Views yet')"
        :description="
          noGrains
            ? __('You are not assigned to a programme, so there are no fields to build a view from. Ask your administrator to set this up.')
            : __('Create a view to slice your leads and activities the way you work.')
        "
        :icon="LucideTable2"
        width="lg"
      />
    </div>
    <template v-else>
      <div class="shrink-0">
        <SmartViewSheet
          v-if="isMobileView"
          v-model="activeView"
          :views="views"
          @reordered="store.views.reload()"
        />
        <SmartViewTabs
          v-else
          v-model="activeView"
          :views="views"
          @create="onCreateView"
          @edit="onEditView"
          @reordered="store.views.reload()"
        />
      </div>
      <!-- `:key` gives each view its own instance (a resource cache key is fixed at creation); `revision` refetches a saved view; rows wait for `store.loaded` because a cached tab list may name a view the person no longer holds. -->
      <KeepAlive :max="5">
        <SmartViewList
          v-if="store.loaded && activeView"
          :key="activeView"
          ref="listRef"
          :viewName="activeView"
          :revision="saves[activeView] || 0"
          :baseObject="activeBaseObject"
          :canEdit="activeCanEdit"
          class="flex-1"
          @openLead="openLead"
          @openTask="openTask"
          @editView="onEditView(activeView)"
          @sharingChanged="store.views.reload()"
        />
      </KeepAlive>
    </template>
  </div>

  <!-- TATVA: authoring dialog (create/edit/delete); v-if gives a fresh instance per open so a previous view's state never paints first. -->
  <SmartViewEditor
    v-if="editorOpen"
    v-model="editorOpen"
    :viewName="editorViewName"
    @saved="onEditorSaved"
    @deleted="onEditorDeleted"
  />

  <!-- TATVA: the one native task modal for activity/task rows (same renderer as the global Tasks list). -->
  <TatvaTaskModal
    v-if="tcModalOpen"
    v-model="tcModalOpen"
    :task="tcTask"
    mode="view"
    @saved="listRef?.fetchRows()"
  />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import SmartViewTabs from '@/tatva/SmartViewTabs.vue'
import SmartViewSheet from '@/tatva/SmartViewSheet.vue'
import SmartViewList from '@/tatva/SmartViewList.vue'
import SmartViewEditor from '@/tatva/SmartViewEditor.vue'
import TatvaTaskModal from '@/tatva/TaskModal.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import { isMobileView } from '@/composables/settings'
import { useEntitledGrains } from '@/tatva/useEntitledGrains'
import { smartViewsStore } from '@/stores/smartViews'
import { Button } from 'frappe-ui'
import LucideTable2 from '~icons/lucide/table-2' // TATVA: Smart Views — a data grid, not an app grid
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const store = smartViewsStore()

// The editor's grain brain, used for authoring only (Create + empty text), never for page visibility.
const { grainAll, grainOptions, resource: grainResource } = useEntitledGrains()
// "No grains" only once the fetch has resolved; pending or failed leaves Create enabled.
const noGrains = computed(
  () => grainResource.data !== null && grainResource.data !== undefined
    && !grainAll.value && grainOptions.value.length === 0,
)

const listRef = ref(null)
// Saves per view: a kept-alive list refetches when its own count moves, so it never shows its old definition.
const saves = reactive({})

const views = computed(() => store.views.data || [])

// The active view name = the :view route param, defaulting to the first tab once loaded.
const activeView = computed({
  get() {
    const param = route.query.view
    if (param && views.value.some((v) => v.name === param)) return param
    return views.value[0]?.name || ''
  },
  set(name) {
    if (name && name !== route.query.view) {
      router.replace({ name: 'SmartViews', query: { view: name } })
    }
  },
})

const activeBaseObject = computed(
  () => store.getView(activeView.value)?.base_object || 'Lead',
)
const activeCanEdit = computed(
  () => !!store.getView(activeView.value)?.can_write,
)
// No on-load URL rewrite: the getter defaults to the first view, and a redirect on mount would remount the page and double-fetch.

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
  saves[tab.name] = (saves[tab.name] || 0) + 1
  activeView.value = tab.name
}
async function onEditorDeleted(name) {
  await store.views.reload()
  // Deleted view was in the URL: move to the first remaining view (check the route param, since activeView already fell back).
  if (route.query.view === name) {
    const first = views.value[0]?.name || ''
    if (first) activeView.value = first
  }
}

// ---- row navigation -------------------------------------------------------
function openLead(leadId) {
  if (leadId) router.push({ name: 'Lead', params: { leadId } })
}

// The one native task modal (as in Tasks.vue): a task row opens that task by name, and the modal resolves its own config.
const tcModalOpen = ref(false)
const tcTask = ref(null)

function openTask(name) {
  tcTask.value = { name }
  tcModalOpen.value = true
}
</script>
