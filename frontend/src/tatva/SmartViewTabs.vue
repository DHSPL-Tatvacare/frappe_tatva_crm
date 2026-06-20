<!--
  TATVA: SmartViewTabs — the DESKTOP Smart View strip (mobile uses SmartViewSheet). LeadSquared model,
  done with PURE CSS flexbox — no measuring, no ResizeObserver, no fit math:

    • The strip is a fixed-width flex row. Every tab is `flex-1 basis-0 min-w-0`, so the tabs SHARE the
      strip equally and each truncates its own label. Adding a tab or a count never moves the right edge
      — the tabs just compress. Short labels show in full; long ones get the ellipsis.
    • Inside a tab: icon · label (truncates) · count pill. The pill is lazy (only shows once that view's
      list has loaded its total — read from the store; nothing else touches the store).
    • Pinned at the right, never moving: a "⋮" full-index menu (jump to any view) and a "+" to add a view.

  v-model carries the active view NAME; the parent maps it to the route and owns the "+" (create) action.
-->
<template>
  <div
    class="flex w-full items-stretch divide-x divide-outline-gray-1 border-b border-outline-gray-2 overflow-hidden"
  >
    <Tooltip
      v-for="tab in views"
      :key="tab.name"
      :text="tab.label"
      class="min-w-0 flex-1 basis-0"
    >
      <button
        type="button"
        class="group -mb-px flex w-full items-center gap-2 border-b-2 px-3 py-2 duration-150 ease-in-out"
        :class="
          tab.name === modelValue
            ? 'border-ink-gray-9'
            : 'border-transparent hover:bg-surface-gray-2'
        "
        @click="select(tab.name)"
      >
        <FeatherIcon
          :name="tabIcon(tab)"
          class="h-4 w-4 shrink-0"
          :class="tab.name === modelValue ? 'text-ink-gray-8' : 'text-ink-gray-5'"
        />
        <span
          class="min-w-0 flex-1 truncate text-left text-sm"
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
      </button>
    </Tooltip>

    <!-- pinned right — never moves: full-index menu + add view -->
    <Popover placement="bottom-end">
      <template #target="{ togglePopover, isOpen }">
        <button
          type="button"
          class="-mb-px flex shrink-0 items-center justify-center border-b-2 px-2.5 duration-150 ease-in-out"
          :class="
            isOpen
              ? 'border-ink-gray-9 text-ink-gray-9'
              : 'border-transparent text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8'
          "
          :aria-label="__('All views')"
          @click="togglePopover"
        >
          <FeatherIcon name="more-vertical" class="h-4 w-4" />
        </button>
      </template>
      <template #body-main>
        <div class="max-h-80 w-64 overflow-y-auto p-1.5">
          <button
            v-for="v in views"
            :key="v.name"
            type="button"
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left duration-150 ease-in-out"
            :class="v.name === modelValue ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
            @click="select(v.name)"
          >
            <FeatherIcon :name="tabIcon(v)" class="h-4 w-4 shrink-0 text-ink-gray-6" />
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
        </div>
      </template>
    </Popover>

    <button
      type="button"
      class="-mb-px flex shrink-0 items-center justify-center border-b-2 border-transparent px-2.5 text-ink-gray-5 duration-150 ease-in-out hover:bg-surface-gray-2 hover:text-ink-gray-8"
      :aria-label="__('Add view')"
      @click="emit('create')"
    >
      <FeatherIcon name="plus" class="h-4 w-4" />
    </button>
  </div>
</template>

<script setup>
import { Tooltip, Popover, FeatherIcon } from 'frappe-ui'
import { smartViewsStore } from '@/stores/smartViews'
import { formatCount } from '@/tatva/smartViewFormat'

defineProps({
  // The ordered tab rows from get_smart_views.
  views: { type: Array, default: () => [] },
  // The active CRM Smart View name (the parent owns selection -> the route).
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'create'])

const store = smartViewsStore()

function select(name) {
  emit('update:modelValue', name)
}

// LSQ-style line icon per tab: a person for lead views, a checkbox for activity views.
function tabIcon(tab) {
  return tab.base_object === 'Activity' ? 'check-square' : 'user'
}
</script>
