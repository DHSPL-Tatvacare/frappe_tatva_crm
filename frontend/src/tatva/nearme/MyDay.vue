<template>
  <!-- MyDay — one day's visits top-down: Completed doctors in the order they were completed, then Pending as numbered stops in the order the route seam chose, then the ones with no location, then Start route (today only). Pure presentation: the page owns the fetch. -->
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- A manager's team, picked with the CRM's own user Link (the Dashboard's user filter); its Clear returns to the viewer's own day. -->
    <div v-if="team.length" class="shrink-0 px-4 pt-3">
      <Link
        class="form-control"
        variant="outline"
        doctype="User"
        :value="repName"
        :filters="{
          name: ['in', team.map((u) => u.name)],
          ignore_user_type: 1,
        }"
        :placeholder="__('My day — pick a rep to see theirs')"
        :hideMe="true"
        @change="(v) => emit('update:rep', v || '')"
      />
    </div>
    <!-- The day: two one-tap chips and the native DatePicker for any later day; the server refuses a past one. -->
    <div class="flex shrink-0 items-center gap-2 px-4 pt-3">
      <Button
        v-for="chip in chips"
        :key="chip.value"
        size="sm"
        :variant="date === chip.value ? 'solid' : 'subtle'"
        :label="chip.label"
        @click="emit('update:date', chip.value)"
      />
      <!-- A phone gets its own OS date picker: a popover anchored once to a sheet that drags and collapses is left floating (the C.13 trap). `min` keeps past days out there too. -->
      <FormControl
        v-if="isMobileView"
        type="date"
        class="ml-auto w-40"
        :modelValue="isChip ? '' : date"
        :min="chips[0].value"
        @update:modelValue="(v) => v && emit('update:date', v)"
      />
      <DatePicker
        v-else
        class="ml-auto w-36"
        variant="subtle"
        :value="isChip ? '' : date"
        :placeholder="__('Another day')"
        @change="(v) => v && emit('update:date', v)"
      />
    </div>
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
    </div>
    <EmptyState
      v-else-if="!stops.length && !unlocated.length && !completed.length"
      class="flex-1"
      width="lg"
      name="Visits"
      :icon="LucideRoute"
      :title="error ? __('Could not plan the day') : __('No visits planned')"
      :description="
        error ||
        (rep
          ? __(
              'Open tasks due this day that are assigned to them show up here.',
            )
          : __(
              'Open tasks due this day that are assigned to you show up here.',
            ))
      "
    />
    <template v-else>
      <div data-sheet-scroll class="min-h-0 flex-1 overflow-y-auto">
        <template v-if="completed.length">
          <div class="px-4 pb-2 pt-3 text-sm font-medium text-ink-gray-6">
            {{ __('Completed · {0}', [completed.length]) }}
          </div>
          <div
            class="flex flex-col divide-y divide-outline-gray-1 border-y border-outline-gray-1"
          >
            <DoctorRow
              v-for="d in completed"
              :key="d.name"
              :doctor="d"
              :caption="completedCaption(d)"
              :territory="territory"
              :selected="d.name === selected"
              :showGrain="false"
              :callable="callable"
              @select="emit('select', d)"
              @call="emit('call', d)"
            />
          </div>
        </template>
        <!-- Pending's header: how many, how far, and who ordered them — road or straight-line, so the number is never mistaken for the other. -->
        <div
          v-if="stops.length"
          class="px-4 pb-2 pt-3 text-sm font-medium text-ink-gray-6"
        >
          {{ summary }}
        </div>
        <div
          class="flex flex-col divide-y divide-outline-gray-1 border-y border-outline-gray-1"
        >
          <DoctorRow
            v-for="(d, i) in stops"
            :key="d.name"
            :doctor="d"
            :index="i + 1"
            :caption="taskCaption(d)"
            :territory="territory"
            :selected="d.name === selected"
            :showGrain="false"
            :callable="callable"
            @select="emit('select', d)"
            @call="emit('call', d)"
          />
        </div>
        <template v-if="unlocated.length">
          <div class="px-4 pb-2 pt-4 text-sm font-medium text-ink-gray-6">
            {{ __('No location') }}
          </div>
          <div
            class="flex flex-col divide-y divide-outline-gray-1 border-y border-outline-gray-1"
          >
            <DoctorRow
              v-for="d in unlocated"
              :key="d.name"
              :doctor="d"
              :caption="taskCaption(d)"
              :territory="territory"
              :selected="d.name === selected"
              :showGrain="false"
              :callable="callable"
              @select="emit('select', d)"
              @call="emit('call', d)"
            />
          </div>
        </template>
      </div>
      <!-- The one action, pinned: the Maps app takes it from here. -->
      <div
        v-if="stops.length && day.is_today && day.is_mine"
        class="shrink-0 border-t border-outline-gray-1 p-3"
      >
        <Button
          variant="solid"
          class="w-full"
          :label="startLabel"
          icon-left="navigation"
          @click="emit('start', stops.slice(0, maxStops))"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { Button, DatePicker, FormControl, dayjs } from 'frappe-ui'
import { computed } from 'vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import Link from '@/components/Controls/Link.vue'
import DoctorRow from '@/tatva/nearme/DoctorRow.vue'
import { formatDate, formatDistance } from '@/utils'
import { isMobileView } from '@/composables/settings'
import LucideRoute from '~icons/lucide/route'

const props = defineProps({
  day: { type: Object, default: null }, // the my_day reply
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }, // the server's own sentence, e.g. a past day refused
  date: { type: String, required: true }, // YYYY-MM-DD
  rep: { type: String, default: '' }, // whose day: '' is the viewer's own
  team: { type: Array, default: () => [] }, // the reps a manager may pick; empty hides the picker
  selected: { type: String, default: '' },
  callable: { type: Boolean, default: false },
  maxStops: { type: Number, required: true }, // how many stops one Google Maps link carries on this device
})

const emit = defineEmits([
  'select',
  'call',
  'start',
  'update:date',
  'update:rep',
])

const chips = [
  { label: __('Today'), value: dayjs().format('YYYY-MM-DD') },
  { label: __('Tomorrow'), value: dayjs().add(1, 'day').format('YYYY-MM-DD') },
]
const isChip = computed(() => chips.some((c) => c.value === props.date))
const repName = computed(
  () =>
    (props.rep && props.team.find((u) => u.name === props.rep)?.full_name) ||
    props.rep,
)

const stops = computed(() => props.day?.stops || [])
const unlocated = computed(() => props.day?.unlocated || [])
const completed = computed(() => props.day?.completed || [])
// The reply as linkTitle.js reads a list, so a stage shows its title.
const territory = computed(() => (props.day ? { data: props.day } : null))

const summary = computed(() =>
  [
    __('Pending · {0}', [stops.value.length]),
    isChip.value ? '' : dayjs(props.date).format('ddd, D MMM'),
    formatDistance(props.day?.distance_m),
    props.day?.by_road ? __('by road') : __('by distance'),
  ]
    .filter(Boolean)
    .join(' · '),
)

const startLabel = computed(() =>
  stops.value.length > props.maxStops
    ? __('Start route · next {0}', [props.maxStops])
    : __('Start route'),
)

// The task(s) that bring the rep here: the first title, and how many more.
function taskCaption(d) {
  const tasks = d.tasks || []
  if (!tasks.length) return ''
  return tasks.length > 1
    ? `${tasks[0].title} +${tasks.length - 1}`
    : tasks[0].title
}

// A completed doctor's line: when the visit was completed, then the task(s) that brought the rep there.
function completedCaption(d) {
  return [
    __('Completed {0}', [formatDate(d.completed_at, 'h:mm a')]),
    taskCaption(d),
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>
