<!--
  TATVA: GrainSelect — the grain control for the Lead/Deal create modal, on the ONE grain brain
  (useEntitledGrains). A single-grain user sees a read-only confirmation and is NEVER asked (the
  value is applied silently); a manager with multiple grains gets a required picker; a System Manager
  sees nothing here (the modal keeps the native vertical/group fields for them). v-model is the
  `vertical::group::program` key — the parent maps it onto the doc with axesFromKey.

  TATVA (write side): an entitlement is a REGION, a lead is a POINT. Where the settled region leaves an
  axis blank — a rep covering an ENTIRE group — that axis is a wildcard and a NEW LEAD must still land on
  ONE leaf, so `resolve-wildcard` renders a required child picker beneath the region and merges the
  choice back into the same key; the v-model contract does not change.

  It is OPT-IN and OFF by default because this control is shared with the Smart View editor, which is the
  READ side: a view scoped to a whole group is legitimate there, and a wildcard axis must stay a wildcard.
  With the prop off, every expression below is the one that was here before, and no options are fetched.
  Options come from ONE endpoint (my_grain_pick_options), which returns {} while `Access::Grain::registry`
  is dormant — so the flag alone decides and this file carries no flag of its own.
-->
<template>
  <!-- TATVA: with a leaf to pick the two controls share one row, mirroring Section.vue/Column.vue so they land on the form's own two-column grid; alone (read side) the region stays full width. -->
  <div
    v-if="!grainAll && (grainOptions.length || grainLoading)"
    :class="pickSpec ? 'flex flex-col gap-4 sm:flex-row' : ''"
  >
    <div class="min-w-0 flex-1">
      <div class="mb-1.5 text-sm text-ink-gray-5">{{ __('Grain') }}</div>
      <FormControl
        v-if="!grainLocked"
        :modelValue="selectValue"
        type="select"
        :options="grainOptions"
        :placeholder="__('Select a grain')"
        :disabled="disabled"
        @update:modelValue="onRegion"
      />
      <div
        v-else
        class="flex items-center gap-1.5 rounded bg-surface-gray-2 px-2.5 py-2 text-sm text-ink-gray-7"
      >
        <FeatherIcon name="lock" class="size-3.5 shrink-0 text-ink-gray-5" />
        {{ grainOptions[0]?.label }}
      </div>
    </div>

    <!-- TATVA: the settled region's wildcard axis — required, because a lead is one leaf. -->
    <div v-if="pickSpec" class="min-w-0 flex-1">
      <div class="mb-1.5 text-sm text-ink-gray-5">{{ pickSpec.label }}</div>
      <FormControl
        :modelValue="pick"
        type="select"
        :options="pickOptions"
        :placeholder="__('Select a program')"
        :disabled="disabled"
        @update:modelValue="(v) => (pick = v)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FormControl, FeatherIcon, createResource } from 'frappe-ui'
import {
  useEntitledGrains,
  axesFromKey,
  keyFromAxes,
} from '@/tatva/useEntitledGrains'

// `disabled` is for a consumer where the grain is settled and may not move (editing a saved Smart View).
const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  // Write side only. Off => this component behaves exactly as it did before (read-side surfaces).
  resolveWildcard: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const { grainAll, grainOptions, grainLocked, grainLoading } = useEntitledGrains()

// One shared, cached resource, on the same lifecycle contract as useEntitledGrains (auto + cache): at
// most one fetch per session, a re-opened modal is served from cache, and a read-side surface — where
// `resolveWildcard` is off — never fetches at all.
const pickResource = createResource({
  url: 'tatva_connect.access.entitlement.my_grain_pick_options',
  cache: 'tatva:grain-pick-options',
  auto: props.resolveWildcard,
})

// The REGION the user has settled on, held apart from `modelValue`: modelValue carries the merged leaf
// and would stop matching its own region the moment a child is picked.
const baseKey = ref('')
const pick = ref('')

const selectValue = computed(() =>
  props.resolveWildcard ? baseKey.value : props.modelValue,
)
const pickSpec = computed(() =>
  props.resolveWildcard ? (pickResource.data || {})[baseKey.value] || null : null,
)
const pickOptions = computed(() =>
  (pickSpec.value?.values || []).map((v) => ({ label: v, value: v })),
)

function onRegion(key) {
  if (!props.resolveWildcard) {
    emit('update:modelValue', key)
    return
  }
  baseKey.value = key
  pick.value = '' // a new region invalidates the child chosen under the old one
}

// Single grain → apply silently so the parent always has the value, without a prompt.
watch(
  [grainLocked, grainOptions],
  () => {
    if (!grainLocked.value || !grainOptions.value.length) return
    if (props.resolveWildcard) {
      if (!baseKey.value) baseKey.value = grainOptions.value[0].value
    } else if (!props.modelValue) {
      emit('update:modelValue', grainOptions.value[0].value)
    }
  },
  { immediate: true },
)

// The one value handed upward: the region, with its wildcard axis filled by the pick. Deliberately blank
// until the pick is made, so the parent's required-check refuses the save — and the server refuses it too.
const resolvedKey = computed(() => {
  if (!baseKey.value) return ''
  if (!pickSpec.value) return baseKey.value
  if (!pick.value) return ''
  return keyFromAxes({
    ...axesFromKey(baseKey.value),
    [pickSpec.value.axis]: pick.value,
  })
})
watch(
  resolvedKey,
  (v) => {
    if (props.resolveWildcard) emit('update:modelValue', v)
  },
  { immediate: true },
)
</script>
