<!--
  TATVA: GrainSelect — the grain control for the create modals and the Smart View editor, on the one grain brain (useEntitledGrains); v-model is the `vertical::group::program` key.
  TATVA: with `resolve-wildcard` (a create modal) the levels a person's permission fixes are locked and each level it leaves open is a pick, drawn from my_filing_leaves: only real grains, the same list Helpdesk's new ticket uses.
  TATVA: without the prop (read side), or while the registry is dormant (`{}`), it is the region select it always was.
-->
<template>
  <div v-if="cascade" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div v-if="!leaves.length" class="min-w-0">
      <div class="mb-1.5 text-sm text-ink-gray-5">{{ __('Grain') }}</div>
      <div class="text-sm text-ink-gray-5">
        {{ __('No grain is open to you. Ask your manager to grant one.') }}
      </div>
    </div>
    <div v-for="row in rows" v-else :key="row.axis" class="min-w-0">
      <div class="mb-1.5 text-sm text-ink-gray-5">{{ row.label }}</div>
      <FormControl
        v-if="row.options.length > 1"
        :modelValue="picks[row.axis]"
        type="select"
        :options="row.options"
        :placeholder="row.placeholder"
        :disabled="disabled"
        @update:modelValue="(v) => choose(row.axis, v)"
      />
      <div
        v-else
        class="flex items-center gap-1.5 rounded bg-surface-gray-2 px-2.5 py-2 text-sm text-ink-gray-7"
      >
        <FeatherIcon name="lock" class="size-3.5 shrink-0 text-ink-gray-5" />
        <span class="truncate">{{ row.text }}</span>
      </div>
    </div>
  </div>
  <div
    v-else-if="!pending && !grainAll && (grainOptions.length || grainLoading)"
  >
    <div class="mb-1.5 text-sm text-ink-gray-5">{{ __('Grain') }}</div>
    <FormControl
      v-if="!grainLocked"
      :modelValue="modelValue"
      type="select"
      :options="grainOptions"
      :placeholder="__('Select a grain')"
      :disabled="disabled"
      @update:modelValue="(v) => emit('update:modelValue', v)"
    />
    <div
      v-else
      class="flex items-center gap-1.5 rounded bg-surface-gray-2 px-2.5 py-2 text-sm text-ink-gray-7"
    >
      <FeatherIcon name="lock" class="size-3.5 shrink-0 text-ink-gray-5" />
      {{ grainOptions[0]?.label }}
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { FormControl, FeatherIcon, createResource } from 'frappe-ui'
import { useEntitledGrains, keyFromAxes } from '@/tatva/useEntitledGrains'

// `disabled` is for a consumer where the grain is settled and may not move (editing a saved Smart View).
const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  resolveWildcard: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const { grainAll, grainOptions, grainLocked, grainLoading } =
  useEntitledGrains()

// One cached fetch per session, and none at all on the read side.
const leavesResource = createResource({
  url: 'tatva_connect.access.entitlement.my_filing_leaves',
  method: 'GET',
  cache: 'tatva:filing-leaves',
  auto: props.resolveWildcard,
})
const leaves = computed(() => leavesResource.data?.grains)
// Waiting on the list: neither control shows, so the region select never flashes before the picks.
const pending = computed(
  () => props.resolveWildcard && !leavesResource.data && !leavesResource.error,
)
const cascade = computed(
  () => props.resolveWildcard && !grainAll.value && Array.isArray(leaves.value),
)

const LEVELS = [
  {
    axis: 'vertical',
    label: __('Product Line'),
    placeholder: __('Select a product line'),
  },
  { axis: 'group', label: __('Group'), placeholder: __('Select a group') },
  {
    axis: 'program',
    label: __('Program'),
    placeholder: __('Select a program'),
  },
]
const picks = reactive({ vertical: '', group: '', program: '' })

// The values each level may take under the levels above it; a blank program is not a choice.
function valuesAt(i) {
  const above = LEVELS.slice(0, i).map((l) => l.axis)
  if (above.some((axis) => !picks[axis])) return []
  const axis = LEVELS[i].axis
  return [
    ...new Set(
      (leaves.value || [])
        .filter((g) => above.every((a) => g[a] === picks[a]))
        .map((g) => g[axis])
        .filter(Boolean),
    ),
  ].sort()
}
const levels = computed(() =>
  LEVELS.map((level, i) => ({
    ...level,
    values: valuesAt(i),
    options: valuesAt(i).map((v) => ({ label: v, value: v })),
  })),
)

// A level with one value is the permission's own and is filled in; a level with several is the person's pick.
watch(
  levels,
  (all) => {
    for (const level of all) {
      if (level.values.length === 1 && picks[level.axis] !== level.values[0])
        picks[level.axis] = level.values[0]
    }
  },
  { immediate: true },
)
// The levels the permission fixes above the first pick read as one locked Grain; every level from the first pick down keeps its own place.
const rows = computed(() => {
  const all = levels.value.filter((l) => l.values.length)
  const firstOpen = all.findIndex((l) => l.values.length > 1)
  const fixed = firstOpen === -1 ? all : all.slice(0, firstOpen)
  const head = fixed.length
    ? [
        {
          axis: 'grain',
          label: __('Grain'),
          options: [],
          text: fixed.map((l) => l.values[0]).join(' · '),
        },
      ]
    : []
  const rest = firstOpen === -1 ? [] : all.slice(firstOpen)
  return [...head, ...rest.map((l) => ({ ...l, text: l.values[0] }))]
})

function choose(axis, value) {
  picks[axis] = value
  const below = LEVELS.findIndex((l) => l.axis === axis) + 1
  for (const level of LEVELS.slice(below)) picks[level.axis] = ''
}

// Blank until the grain is a real one, so the modal's required check and the server both refuse.
const resolvedKey = computed(() => {
  const leaf = (leaves.value || []).find((g) =>
    LEVELS.every((l) => (g[l.axis] || '') === picks[l.axis]),
  )
  return leaf ? keyFromAxes(leaf) : ''
})
watch(
  [cascade, resolvedKey],
  ([on, key]) => {
    if (on) emit('update:modelValue', key)
  },
  { immediate: true },
)

// Read side, and the dormant registry: one grain is applied without a question.
watch(
  [grainLocked, grainOptions, cascade],
  () => {
    if (cascade.value || props.modelValue) return
    if (grainLocked.value && grainOptions.value.length)
      emit('update:modelValue', grainOptions.value[0].value)
  },
  { immediate: true },
)
</script>
