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
    <!-- FAILED is its own verdict, never an empty state in costume: a blip on the tab list must not read as "you have no views" beside a Create button (SV-17). -->
    <div
      v-else-if="!store.loaded && store.views.error"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-ink-gray-5"
    >
      <div>{{ __('Could not load your views.') }}</div>
      <Button :label="__('Retry')" @click="store.reload()" />
    </div>
    <!-- Empty: the native EmptyState alone, text-only like Deals/Tasks/Notes. The create affordance is the header Button, which stays put when the list is empty. -->
    <!-- The SERVER's offer list is the only visibility verdict (E2): a shared view reaches a rep with no grain of their own, so entitlement may flavour the empty text but never outrank views that exist. -->
    <div v-else-if="!views.length" class="flex flex-1 flex-col">
      <!-- width=lg: EmptyState's own prop. The default (w-4/12, about 130px at 390px) wraps this title. -->
      <EmptyState
        name="Smart Views"
        :title="noGrains ? __('No programme access yet') : __('No Smart Views yet')"
        :description="
          noGrains
            ? __('You are not assigned to a programme, so there are no fields to build a view from. Ask your administrator to set this up.')
            : __('Create a view to slice your leads and activities the way you work.')
        "
        :icon="LucideLayoutGrid"
        width="lg"
      />
    </div>
    <template v-else>
      <div class="shrink-0">
        <SmartViewSheet
          v-if="isMobileView"
          v-model="activeView"
          :views="views"
        />
        <SmartViewTabs
          v-else
          v-model="activeView"
          :views="views"
          @create="onCreateView"
          @edit="onEditView"
        />
      </div>
      <!-- No :key here: the whole page already remounts on any view change (App.vue keys
           router-view on $route.path, and the active view IS a path param). A second key
           on the list would remount it a second time on the same navigation → double get_data
           (seen on create, where store.views.reload() splits the route change across ticks). -->
      <!-- @sharingChanged: a share/public flip must reach the tab store, or is_standard/can_write go stale until a hard reload (SV-08, B4: invalidation is explicit). -->
      <SmartViewList
        :key="activeView"
        v-if="activeView"
        ref="listRef"
        :viewName="activeView"
        :baseObject="activeBaseObject"
        :canEdit="activeCanEdit"
        class="flex-1"
        @openLead="openLead"
        @openTask="openTask"
        @editView="onEditView(activeView)"
        @sharingChanged="store.views.reload()"
      />
    </template>
  </div>

  <!-- TATVA: authoring drawer (create/edit/delete) — inline wizard controls; the toolbar's native Filter/ColumnSettings are popovers and belong to the read surface, not a wizard step. -->
  <!-- v-if + v-model is the stock contract (GlobalModals/DoctypeModals): v-if gives a fresh drawer per open, so the previously edited view's state can never paint first. -->
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
import TatvaTaskModal from '@/tatva/TaskModal.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import { isMobileView } from '@/composables/settings'
import { useEntitledGrains } from '@/tatva/useEntitledGrains'
import { smartViewsStore } from '@/stores/smartViews'
import { Button } from 'frappe-ui'
import LucideLayoutGrid from '~icons/lucide/layout-grid'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const store = smartViewsStore()

// Read from the SAME grain brain the editor uses — no second entitlement call, no second answer.
// AUTHORING only: it disables Create and flavours the empty text; it never decides page visibility —
// the server's offer list does (a second, stricter client rule contradicted api.py and hid shared views).
const { grainAll, grainOptions, resource: grainResource } = useEntitledGrains()
// "No grains" is a SETTLED verdict: only once the fetch has actually resolved — pending or failed is
// neither yes nor no, so the button stays enabled and the editor's own states take over.
const noGrains = computed(
  () => grainResource.data !== null && grainResource.data !== undefined
    && !grainAll.value && grainOptions.value.length === 0,
)

const listRef = ref(null)

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
  // If the DELETED view was the one in the URL, navigate to the first remaining view so the URL
  // doesn't keep a now-invalid view id. (Check the route param, not activeView — its getter has
  // already fallen back to the first view once the param is invalid.)
  if (route.query.view === name) {
    const first = views.value[0]?.name || ''
    if (first) activeView.value = first
  }
}

// ---- row navigation -------------------------------------------------------
function openLead(leadId) {
  if (leadId) router.push({ name: 'Lead', params: { leadId } })
}

// The one native task modal (mirrors pages/Tasks.vue): a task row opens that exact task by name.
// It resolves its own map config (composables/mapConfig.js) — this page has no business fetching one.
const tcModalOpen = ref(false)
const tcTask = ref(null)

function openTask(name) {
  tcTask.value = { name }
  tcModalOpen.value = true
}
</script>
