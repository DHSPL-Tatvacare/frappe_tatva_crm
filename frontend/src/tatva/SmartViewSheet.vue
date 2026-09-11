<!--
  TATVA: SmartViewSheet — the MOBILE/PWA Smart View picker (the bottom-sheet analogue of the desktop
  SmartViewTabs strip). A horizontal tab strip is wrong on a phone, so on mobile the page renders this
  instead: a full-width "current view" button (icon · label · lazy count · chevron) that opens a
  TatvaBottomSheet listing every view — scrollable, the active one check-marked, each carrying its lazy
  count bubble (store.getCount, §6). Picking one emits update:modelValue and closes. Same store, same
  count cache, same selection contract as the desktop strip — only the surface differs.
-->
<template>
  <div class="border-b border-outline-gray-2 px-3 py-2">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-left"
      @click="open = true"
    >
      <Icon
        v-if="active"
        :icon="tabIcon(active)"
        class="h-4 w-4 shrink-0 text-ink-gray-7"
      />
      <span class="min-w-0 flex-1 truncate text-base font-medium text-ink-gray-9">
        {{ active?.label || __('Select a view') }}
      </span>
      <span
        v-if="activeCount !== null"
        class="shrink-0 rounded bg-surface-gray-3 px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink-gray-7"
      >
        {{ activeCount }}
      </span>
      <FeatherIcon name="chevron-down" class="h-4 w-4 shrink-0 text-ink-gray-5" />
    </button>

    <TatvaBottomSheet v-model="open" :title="__('Smart Views')">
      <!-- The list IS the reorder control, exactly as ColumnSettings' column list is: no mode, no
           Arrange button, no second dismiss. `delay` on touch is what separates a tap (select the
           view) from a press-and-drag (reorder it), the same 200ms ColumnSettings relies on.
           Committed on drop — this app has never had a Save button for reordering. -->
      <Draggable
        :list="rows"
        :delay="isTouchScreenDevice() ? 200 : 0"
        item-key="name"
        tag="ul"
        class="flex flex-col px-2"
        @end="persist"
      >
        <template #item="{ element: v }">
        <li :key="v.name">
          <!-- The handle sits INSIDE the highlighted row, as it does in ColumnSettings: one control,
               symmetric `px-2`, so the selected row's fill ends the same distance from both edges. -->
          <button
            type="button"
            class="flex w-full cursor-grab items-center gap-2 rounded px-2 py-2.5 text-left"
            :class="v.name === modelValue ? 'bg-surface-gray-2' : 'active:bg-surface-gray-2'"
            @click="select(v.name)"
          >
            <DragIcon class="h-3.5 shrink-0 text-ink-gray-4" />
            <Icon
              :icon="tabIcon(v)"
              class="h-4 w-4 shrink-0 text-ink-gray-7"
            />
            <span
              class="min-w-0 flex-1 truncate text-base"
              :class="
                v.name === modelValue
                  ? 'font-medium text-ink-gray-9'
                  : 'text-ink-gray-8'
              "
            >
              {{ v.label }}
            </span>
            <span
              v-if="store.getCount(v.name) !== null"
              class="shrink-0 rounded bg-surface-gray-3 px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink-gray-7"
            >
              {{ formatCount(store.getCount(v.name)) }}
            </span>
            <FeatherIcon
              v-if="v.name === modelValue"
              name="check"
              class="h-4 w-4 shrink-0 text-ink-gray-9"
            />
          </button>
        </li>
        </template>
      </Draggable>
      <!-- Offered only once an order exists to undo, the way ColumnSettings shows "Reset Changes"
           only when the columns have been touched. -->
      <div
        v-if="ordered"
        class="mx-2 mt-1.5 flex flex-col gap-1 border-t border-outline-gray-modals pt-1.5"
      >
        <Button
          class="w-full !justify-start !text-ink-gray-5"
          variant="ghost"
          :label="__('Reset Order')"
          :iconLeft="ReloadIcon"
          @click="resetOrder"
        />
      </div>
    </TatvaBottomSheet>
  </div>
</template>

<script setup>
import { Button, FeatherIcon } from 'frappe-ui'
import Icon from '@/components/Icon.vue'
import DragIcon from '@/components/Icons/DragIcon.vue'
import ReloadIcon from '@/components/Icons/ReloadIcon.vue'
import Draggable from 'vuedraggable'
import { isTouchScreenDevice } from '@/utils'
import { useTabOrder } from '@/tatva/useTabOrder'
import TatvaBottomSheet from '@/tatva/TatvaBottomSheet.vue'
import { computed, ref, watch } from 'vue'
import { smartViewsStore } from '@/stores/smartViews'
import { formatCount, tabIcon } from '@/tatva/smartViewFormat'

const props = defineProps({
  views: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'reordered'])

const store = smartViewsStore()
const open = ref(false)

// vuedraggable mutates the list it is handed, so it gets its own copy of the store's views rather
// than the prop. Reseeded whenever the server's order comes back.
const rows = ref([])
const ordered = ref(false)
watch(() => props.views, (v) => (rows.value = [...(v || [])]), { immediate: true })

const { save, reset } = useTabOrder('CRM Smart View')

async function persist() {
  if (await save(rows.value.map((r) => r.name))) {
    ordered.value = true
    emit('reordered')
  }
}

async function resetOrder() {
  if (await reset()) {
    ordered.value = false
    emit('reordered')
  }
}

const active = computed(() =>
  props.views.find((v) => v.name === props.modelValue),
)
const activeCount = computed(() => {
  const c = store.getCount(props.modelValue)
  return c === null ? null : formatCount(c)
})

function select(name) {
  emit('update:modelValue', name)
  open.value = false
}
</script>
