<!-- TATVA: SmartViewTabs — the desktop Smart View strip: content-sized tabs on a rail that scrolls like frappe-ui Tabs, every view in a searchable "⋮" index; v-model is the active view name. -->
<template>
  <div class="flex w-full items-stretch border-b border-outline-gray-2 overflow-hidden">
    <!-- The native horizontal scroller (ViewControls' quick filters): tabs keep their order, the edge fades while more lies past it. -->
    <FadedScrollableDiv
      ref="rail"
      orientation="horizontal"
      class="flex min-w-0 flex-1 items-stretch divide-x divide-outline-gray-1 overflow-x-auto"
    >
      <button
        v-for="tab in views"
        :key="tab.name"
        type="button"
        :title="tab.label"
        :data-active="tab.name === modelValue ? 'true' : 'false'"
        class="group relative flex max-w-[12rem] shrink-0 items-center gap-2 px-3 py-2 duration-150 ease-in-out"
        :class="tab.name === modelValue ? '' : 'hover:bg-surface-gray-2'"
        @click="select(tab.name)"
      >
        <Icon
          :icon="tabIcon(tab)"
          class="h-4 w-4 shrink-0"
          :class="tab.name === modelValue ? 'text-ink-gray-8' : 'text-ink-gray-5'"
        />
        <span
          class="min-w-0 truncate text-left text-sm"
          :class="
            tab.name === modelValue
              ? 'font-medium text-ink-gray-9'
              : 'text-ink-gray-6 group-hover:text-ink-gray-8'
          "
        >
          {{ tab.label }}
        </span>
        <span
          v-if="store.getCount(tab.name) !== null"
          class="shrink-0 rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs font-medium tabular-nums"
          :class="tab.name === modelValue ? 'text-ink-gray-7' : 'text-ink-gray-5'"
        >
          {{ formatCount(store.getCount(tab.name)) }}
        </span>
        <!-- active indicator: theme-aware (dark in light, light in dark), one per active tab -->
        <span
          v-if="tab.name === modelValue"
          class="absolute inset-x-0 bottom-0 h-0.5 bg-surface-gray-7"
        />
      </button>
    </FadedScrollableDiv>

    <!-- The "⋮" index: never compressed (shrink-0); creating a view is the header's Create, not a second button here. -->
    <div class="flex shrink-0 items-stretch border-l border-outline-gray-1">
      <Popover placement="bottom-end">
        <template #target="{ togglePopover, isOpen }">
          <button
            type="button"
            class="flex items-center justify-center px-2.5 py-2 duration-150 ease-in-out"
            :class="
              isOpen
                ? 'text-ink-gray-9'
                : 'text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8'
            "
            :aria-label="__('All views')"
            @click="togglePopover"
          >
            <FeatherIcon name="more-vertical" class="h-4 w-4" />
          </button>
        </template>
        <template #body-main="{ close }">
          <div class="w-72 p-1.5">
            <FormControl
              v-model="query"
              type="text"
              :placeholder="__('Search views…')"
              class="mb-1.5"
            >
              <template #prefix>
                <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
              </template>
            </FormControl>
            <div v-if="!matches.length" class="px-2 py-3 text-center text-sm text-ink-gray-5">
              {{ __('No views match') }}
            </div>
            <!-- The list is the reorder control (as in ColumnSettings); dragging is off while a search narrows it. -->
            <Draggable
              :list="matches"
              :disabled="!!query.trim()"
              :delay="isTouchScreenDevice() ? 200 : 0"
              item-key="name"
              class="max-h-80 overflow-y-auto"
              @end="persist"
            >
            <template #item="{ element: v }">
            <div
              :key="v.name"
              class="group/row flex cursor-grab items-center gap-1 rounded duration-150 ease-in-out"
              :class="v.name === modelValue ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
            >
              <DragIcon v-if="!query.trim()" class="ml-1.5 h-3.5 shrink-0 text-ink-gray-4" />
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                @click="select(v.name)"
              >
                <Icon :icon="tabIcon(v)" class="h-4 w-4 shrink-0 text-ink-gray-6" />
                <span
                  class="min-w-0 flex-1 truncate text-sm"
                  :class="v.name === modelValue ? 'font-medium text-ink-gray-9' : 'text-ink-gray-7'"
                >
                  {{ v.label }}
                </span>
                <span
                  v-if="store.getCount(v.name) !== null"
                  class="shrink-0 rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink-gray-5"
                >
                  {{ formatCount(store.getCount(v.name)) }}
                </span>
                <FeatherIcon
                  v-if="v.name === modelValue"
                  name="check"
                  class="h-3.5 w-3.5 shrink-0 text-ink-gray-9"
                />
              </button>
              <!-- edit affordance: only when the caller can write this view (server re-checks) -->
              <button
                v-if="v.can_write"
                type="button"
                class="mr-1 hidden shrink-0 rounded p-1 text-ink-gray-5 duration-150 ease-in-out hover:bg-surface-gray-4 hover:text-ink-gray-8 group-hover/row:block"
                :aria-label="__('Edit view')"
                @click="onEdit(v.name, close)"
              >
                <FeatherIcon name="edit-2" class="h-3.5 w-3.5" />
              </button>
            </div>
            </template>
            </Draggable>
            <div
              v-if="ordered"
              class="mt-1.5 flex flex-col gap-1 border-t border-outline-gray-modals pt-1.5"
            >
              <Button
                class="w-full !justify-start !text-ink-gray-5"
                variant="ghost"
                :label="__('Reset Order')"
                :iconLeft="ReloadIcon"
                @click="resetOrder"
              />
            </div>
          </div>
        </template>
      </Popover>
    </div>
  </div>
</template>

<script setup>
import { Button, Popover, FeatherIcon, FormControl } from 'frappe-ui'
import DragIcon from '@/components/Icons/DragIcon.vue'
import ReloadIcon from '@/components/Icons/ReloadIcon.vue'
import Draggable from 'vuedraggable'
import { isTouchScreenDevice } from '@/utils'
import { useTabOrder } from '@/tatva/useTabOrder'
import Icon from '@/components/Icon.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { smartViewsStore } from '@/stores/smartViews'
import { formatCount, tabIcon } from '@/tatva/smartViewFormat'

const props = defineProps({
  // The ordered tab rows from get_smart_views.
  views: { type: Array, default: () => [] },
  // The active CRM Smart View name (the parent owns selection -> the route).
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'edit', 'reordered'])

// `matches` (the search filter) drives what is SHOWN; dragging is disabled while a query is active, so an order is only written from the whole list.
const { rows, ordered, persist, resetOrder } = useTabOrder('CRM Smart View', () => props.views, () => emit('reordered'))

const store = smartViewsStore()

// The rail is the scroller; the active tab is brought into it, so picking a view from "⋮" never leaves it out of sight.
const rail = ref(null)
function revealActive() {
  rail.value?.$el?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
onMounted(revealActive)
// After the DOM settles, on a new selection or a new list (a created view lands on the rail after its tab renders).
watch(() => [props.modelValue, props.views], revealActive, { flush: 'post' })

// --- the ⋮ index: every view, searchable ------------------------------------
const query = ref('')
// Filters the draggable copy, so with no query the shown list and the reordered list are the same array.
const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? rows.value.filter((v) => (v.label || '').toLowerCase().includes(q)) : rows.value
})

function select(name) {
  emit('update:modelValue', name)
}

function onEdit(name, close) {
  close?.()
  emit('edit', name)
}

// The icon rule lives ONCE in smartViewFormat.tabIcon — the sheet renders the same answer.
</script>
