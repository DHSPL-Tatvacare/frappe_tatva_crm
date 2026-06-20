<!--
  TATVA: SmartViewSheet — the MOBILE/PWA Smart View picker (the bottom-sheet analogue of the desktop
  SmartViewTabs strip). A horizontal tab strip is wrong on a phone, so on mobile the page renders this
  instead: a full-width "current view" button (icon · label · lazy count · chevron) that opens a
  TatvaBottomSheet listing every view — scrollable, the active one check-marked, each carrying its lazy
  count bubble (store.getCount, §6). Picking one emits update:modelValue and closes. Same store, same
  count cache, same selection contract as the desktop strip — only the surface differs.
-->
<template>
  <div class="px-3 py-2">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-left"
      @click="open = true"
    >
      <Icon
        v-if="active?.icon"
        :icon="active.icon"
        class="h-4 w-4 shrink-0 text-ink-gray-7"
      />
      <span class="min-w-0 flex-1 truncate text-base font-medium text-ink-gray-9">
        {{ active?.label || __('Select a view') }}
      </span>
      <span
        v-if="activeCount !== null"
        class="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-surface-gray-3 px-1.5 text-xs font-medium tabular-nums text-ink-gray-8"
      >
        {{ activeCount }}
      </span>
      <FeatherIcon name="chevron-down" class="h-4 w-4 shrink-0 text-ink-gray-5" />
    </button>

    <TatvaBottomSheet v-model="open" :title="__('Smart Views')">
      <ul class="flex flex-col">
        <li v-for="v in views" :key="v.name">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
            :class="v.name === modelValue ? 'bg-surface-gray-2' : 'active:bg-surface-gray-2'"
            @click="select(v.name)"
          >
            <Icon
              v-if="v.icon"
              :icon="v.icon"
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
              class="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-surface-gray-3 px-1.5 text-xs font-medium tabular-nums text-ink-gray-7"
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
      </ul>
    </TatvaBottomSheet>
  </div>
</template>

<script setup>
import { FeatherIcon } from 'frappe-ui'
import Icon from '@/components/Icon.vue'
import TatvaBottomSheet from '@/tatva/TatvaBottomSheet.vue'
import { computed, ref } from 'vue'
import { smartViewsStore } from '@/stores/smartViews'
import { formatCount } from '@/tatva/smartViewFormat'

const props = defineProps({
  views: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const store = smartViewsStore()
const open = ref(false)

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
