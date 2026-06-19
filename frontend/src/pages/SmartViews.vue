<!--
  TATVA: Smart Views — the read-only grain surface (P1). Modelled on pages/NearMe.vue: a LayoutHeader
  with ViewBreadcrumbs in #left-header, then the row of SmartViewTabs over a single SmartViewList that
  re-keys to the active view. Tabs/list are pure frappe-ui primitives fed by the smartViews store
  (get_smart_views) and the get_data composer. The active view lives in the route (/smart-views/:view)
  so tabs are deep-linkable. No authoring here — that is P2. No business logic; pure presentation.
-->
<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs routeName="SmartViews" />
    </template>
  </LayoutHeader>

  <div class="flex flex-1 flex-col overflow-hidden">
    <div v-if="!store.loaded && store.views.loading" class="flex flex-1 items-center justify-center text-sm text-ink-gray-5">
      {{ __('Loading…') }}
    </div>
    <div v-else-if="!views.length" class="flex flex-1 items-center justify-center text-sm text-ink-gray-5">
      {{ __('No Smart Views available.') }}
    </div>
    <template v-else>
      <div class="shrink-0 border-b border-outline-gray-1">
        <SmartViewTabs :views="views" v-model="activeView" />
      </div>
      <SmartViewList
        v-if="activeView"
        :key="activeView"
        :viewName="activeView"
        :baseObject="activeBaseObject"
        class="flex-1"
      />
    </template>
  </div>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import SmartViewTabs from '@/tatva/SmartViewTabs.vue'
import SmartViewList from '@/tatva/SmartViewList.vue'
import { smartViewsStore } from '@/stores/smartViews'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const store = smartViewsStore()

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
</script>
