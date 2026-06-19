<!--
  TATVA: SmartViewTabs — the row of Smart View tabs. Built on the frappe-ui Tabs primitive: it maps
  the smartViews store rows to Tabs' :tabs prop and renders each label + a frappe-ui Badge in the
  #tab-item slot. The Badge shows the per-tab COUNT, which is LAZY (§6): a tab shows NO count until
  it is the active tab and its list has loaded (the list pushes its `total` into the store via
  store.setCount). No pre-fetch, no batched 20-tab count query — clicking a tab loads its list, which
  is its count. v-model carries the active tab INDEX (Tabs' default); the parent maps it to a view
  name and route. The list body itself lives in the parent page (one list, re-keyed per active view).
-->
<template>
  <Tabs
    v-if="tabs.length"
    v-model="activeIndex"
    as="div"
    :tabs="tabs"
    class="[&_[role='tabpanel']]:hidden"
  >
    <template #tab-item="{ tab }">
      <button
        type="button"
        class="flex items-center gap-1.5 py-2.5 text-base text-ink-gray-5 duration-300 ease-in-out hover:text-ink-gray-9 data-[state=active]:text-ink-gray-9"
      >
        <Icon v-if="tab.icon" :icon="tab.icon" class="h-4 w-4" />
        <span>{{ tab.label }}</span>
        <Badge
          v-if="tab.count !== null"
          :label="String(tab.count)"
          theme="gray"
          variant="subtle"
          size="sm"
        />
      </button>
    </template>
  </Tabs>
</template>

<script setup>
import { Tabs, Badge } from 'frappe-ui'
import Icon from '@/components/Icon.vue'
import { computed } from 'vue'
import { smartViewsStore } from '@/stores/smartViews'

const props = defineProps({
  // The ordered tab rows from get_smart_views.
  views: { type: Array, default: () => [] },
  // The active CRM Smart View name (the parent owns selection -> the route).
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const store = smartViewsStore()

// frappe-ui Tabs needs { label, icon? }; we add `count` (null until loaded) for the badge.
const tabs = computed(() =>
  props.views.map((v) => ({
    label: v.label,
    icon: v.icon || undefined,
    name: v.name,
    count: store.getCount(v.name),
  })),
)

// Bridge Tabs' index model <-> the active view NAME the parent uses.
const activeIndex = computed({
  get() {
    const i = props.views.findIndex((v) => v.name === props.modelValue)
    return i < 0 ? 0 : i
  },
  set(i) {
    const v = props.views[i]
    if (v) emit('update:modelValue', v.name)
  },
})
</script>
