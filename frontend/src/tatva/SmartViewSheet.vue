<!-- TATVA: SmartViewSheet — the mobile Smart View picker: a current-view button opening a bottom sheet of every view, with the same store, counts and v-model contract as SmartViewTabs. -->
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
      <!-- The list is the reorder control, saved on drop; the touch `delay` separates a tap (select) from press-and-drag (reorder). -->
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
          <!-- The drag handle sits inside the highlighted row, as in ColumnSettings, so the fill is symmetric. -->
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
      <!-- Offered only once a personal order exists to undo. -->
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
import { computed, ref } from 'vue'
import { smartViewsStore } from '@/stores/smartViews'
import { formatCount, tabIcon } from '@/tatva/smartViewFormat'

const props = defineProps({
  views: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'reordered'])

const store = smartViewsStore()
const open = ref(false)

const { rows, ordered, persist, resetOrder } = useTabOrder('CRM Smart View', () => props.views, () => emit('reordered'))

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
