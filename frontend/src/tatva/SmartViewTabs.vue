<!--
  TATVA: SmartViewTabs — the DESKTOP Smart View strip (mobile uses SmartViewSheet). Pure CSS flexbox,
  no measuring:

    • The strip is a fixed-width flex row. Each TAB IS the flex child (`flex-1 basis-0 min-w-0`), so tabs
      share the strip equally and truncate their own label — adding a tab or a count never moves the
      right edge, the tabs just compress. (The tooltip is a native `title` so no wrapper breaks the flex.)
    • The right controls — a "⋮" full-index menu and a "+" add-view — sit in a `shrink-0` group that can
      never be pushed out: the tabs give up width first.
    • Count is a lazy pill (only once that view's list has loaded its total, read from the store).
    • Active tab: a 2px underline pulled onto the strip's baseline with `-mb-px`.

  v-model carries the active view NAME; the parent maps it to the route and owns "+" (create).
-->
<template>
  <div
    class="flex w-full items-stretch divide-x divide-outline-gray-1 border-b border-outline-gray-2 overflow-hidden"
  >
    <button
      v-for="tab in views"
      :key="tab.name"
      type="button"
      :title="tab.label"
      class="group relative flex min-w-0 flex-1 basis-0 items-center gap-2 px-3 py-2 duration-150 ease-in-out"
      :class="tab.name === modelValue ? '' : 'hover:bg-surface-gray-2'"
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
      <!-- active indicator: theme-aware (dark in light, light in dark), one per active tab -->
      <span
        v-if="tab.name === modelValue"
        class="absolute inset-x-0 bottom-0 h-0.5 bg-surface-gray-7"
      />
    </button>

    <!-- right controls: never compressed (shrink-0). Full-index menu + add view. -->
    <div class="flex shrink-0 items-stretch divide-x divide-outline-gray-1">
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
          <div class="max-h-80 w-64 overflow-y-auto p-1.5">
            <div
              v-for="v in views"
              :key="v.name"
              class="group/row flex items-center gap-1 rounded duration-150 ease-in-out"
              :class="v.name === modelValue ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
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
          </div>
        </template>
      </Popover>

      <button
        type="button"
        class="flex items-center justify-center px-2.5 py-2 text-ink-gray-5 duration-150 ease-in-out hover:bg-surface-gray-2 hover:text-ink-gray-8"
        :aria-label="__('Add view')"
        @click="emit('create')"
      >
        <FeatherIcon name="plus" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { Popover, FeatherIcon } from 'frappe-ui'
import { smartViewsStore } from '@/stores/smartViews'
import { formatCount } from '@/tatva/smartViewFormat'

defineProps({
  // The ordered tab rows from get_smart_views.
  views: { type: Array, default: () => [] },
  // The active CRM Smart View name (the parent owns selection -> the route).
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'create', 'edit'])

const store = smartViewsStore()

function select(name) {
  emit('update:modelValue', name)
}

function onEdit(name, close) {
  close?.()
  emit('edit', name)
}

// LSQ-style line icon per tab: a person for lead views, a checkbox for activity views.
function tabIcon(tab) {
  return tab.base_object === 'Activity' ? 'check-square' : 'user'
}
</script>
