<template>
  <!-- RegistryPanel — Near Me's Registry tab: search + filter, one summary line, the area jump, then the rows. The state is the page's registry, injected. -->
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Two rows: search + filter, then one quiet summary — count · radius · the neighbourhood (its full address on tap). -->
    <div class="flex shrink-0 flex-col gap-2 px-4 pb-3 pt-3">
      <div class="flex items-center gap-2">
        <FormControl
          v-model="search"
          class="min-w-0 flex-1"
          type="text"
          :placeholder="__('Search the registry or a place')"
        >
          <template #prefix
            ><FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5"
          /></template>
        </FormControl>
        <Popover placement="bottom-end">
          <template #target="{ togglePopover }">
            <!-- The list views' own FilterIcon, icon-only until a filter is on, then with its count (Filter.vue's shape). -->
            <Button
              :tooltip="__('Filter')"
              :label="activeFilters ? String(activeFilters) : __('Filter')"
              :icon="activeFilters ? undefined : FilterIcon"
              :iconLeft="activeFilters ? FilterIcon : undefined"
              @click="togglePopover"
            />
          </template>
          <template #body-main>
            <div class="flex w-56 flex-col gap-3 p-3">
              <FormControl
                v-model="filterStage"
                type="select"
                :label="__('Stage')"
                :options="stageOptions"
              />
              <FormControl
                v-model="filterSource"
                type="select"
                :label="__('Source')"
                :options="sourceOptions"
              />
              <FormControl
                v-model="filterGrain"
                type="select"
                :label="__('Business line')"
                :options="grainOptions"
              />
              <Button :label="__('Clear filters')" @click="clearFilters" />
            </div>
          </template>
        </Popover>
      </div>

      <!-- The count carries the SAME narrowing as the list (C7); a name search reaches the whole book, so it drops the radius and the place. -->
      <div
        v-if="where.origin.value"
        class="flex min-w-0 items-center gap-1 text-sm text-ink-gray-6"
      >
        <span class="shrink-0 font-medium text-ink-gray-9">{{
          __('{0} in registry', [countLabel])
        }}</span>
        <template v-if="scope === 'ring'">
          <span class="shrink-0 text-ink-gray-4">·</span>
          <!-- The toolbar idiom BulkJobFilters uses: a ghost button with a chevron, never a form-width Select. -->
          <Dropdown :options="radiusOptions" class="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              :label="radiusKm ? __('{0} km', [radiusKm]) : '…'"
              icon-right="chevron-down"
            />
          </Dropdown>
          <template v-if="where.originArea.value">
            <span class="shrink-0 text-ink-gray-4">·</span>
            <Popover placement="bottom-start" class="min-w-0">
              <template #target="{ togglePopover }">
                <button
                  type="button"
                  class="block max-w-full truncate hover:text-ink-gray-8"
                  @click="togglePopover"
                >
                  {{ __('near {0}', [where.originArea.value]) }}
                </button>
              </template>
              <template #body-main>
                <div
                  class="flex w-64 items-start gap-2 p-3 text-sm text-ink-gray-7"
                >
                  <FeatherIcon
                    :name="where.searchedArea.value ? 'map-pin' : 'navigation'"
                    class="mt-0.5 h-4 w-4 shrink-0 text-ink-gray-5"
                  />
                  <span>
                    {{ where.originAddress.value }}
                    <!-- A reading this loose names a street it cannot vouch for, so it says so instead of posing as an address. -->
                    <span v-if="approximate" class="text-ink-gray-5">{{
                      __('· approximate')
                    }}</span>
                  </span>
                </div>
              </template>
            </Popover>
          </template>
        </template>
        <span v-else class="min-w-0 truncate">{{
          __('matching “{0}”', [search.trim()])
        }}</span>
      </div>
      <div v-if="capped" class="text-xs text-ink-gray-5">
        {{
          __(
            'Only the nearest {0} are shown — narrow the radius to see everything in it.',
            [doctors.length],
          )
        }}
      </div>

      <!-- Places that match what was typed. Picking one moves the search to that area — the reason a
           rep can look at tomorrow's territory, and the reason a UAE bench is testable from Bengaluru. -->
      <div
        v-if="areaResults.length"
        class="flex flex-col overflow-hidden rounded-lg border border-outline-gray-2"
      >
        <button
          v-for="(place, i) in areaResults"
          :key="i"
          type="button"
          class="flex items-start gap-2 border-b border-outline-gray-1 px-3 py-2 text-left text-sm text-ink-gray-7 last:border-b-0 hover:bg-surface-gray-2"
          @click="goToArea(place)"
        >
          <FeatherIcon
            name="map-pin"
            class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-gray-5"
          />
          <span class="line-clamp-2">{{ place.address }}</span>
        </button>
      </div>
    </div>

    <!-- rows; an empty or loading list is the native EmptyState in a full-height box (C.5), as every list in the CRM does it -->
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
      <div v-if="loading" class="flex flex-1 items-center justify-center">
        <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
      </div>
      <!-- `origin` gates it: with no location the map area is already asking for one. -->
      <EmptyState
        v-else-if="where.origin.value && !filteredDoctors.length"
        class="flex-1"
        width="lg"
        name="Registry"
        :icon="LucideStethoscope"
        :title="emptyTitle"
        :description="emptyDescription"
      />
      <div
        v-else
        class="flex flex-col divide-y divide-outline-gray-1 border-t border-outline-gray-1"
      >
        <DoctorRow
          v-for="d in filteredDoctors"
          :key="d.name"
          :ref="(el) => registerRow(d.name, el)"
          :doctor="d"
          :territory="territory"
          :selected="d.name === selected"
          :showGrain="territoryIsMixed"
          :callable="callable"
          @select="emit('select', d)"
          @call="emit('call', d)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { Button, Dropdown, FeatherIcon, FormControl, Popover } from 'frappe-ui'
import { inject, nextTick } from 'vue'
import DoctorRow from '@/tatva/nearme/DoctorRow.vue'
import { REGISTRY } from '@/tatva/nearme/useRegistry'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import FilterIcon from '@/components/Icons/FilterIcon.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import LucideStethoscope from '~icons/lucide/stethoscope'

defineProps({
  selected: { type: String, default: '' }, // C4 — the one selected doctor, owned by the page
  callable: { type: Boolean, default: false }, // a one-tap call icon on each row (mobile)
  approximate: { type: Boolean, default: false }, // the reading is an area, not a point
})

const emit = defineEmits(['select', 'call'])

const {
  where,
  doctors,
  territory,
  loading,
  scope,
  capped,
  radiusKm,
  radiusOptions,
  filterStage,
  filterSource,
  filterGrain,
  stageOptions,
  sourceOptions,
  grainOptions,
  filteredDoctors,
  territoryIsMixed,
  countLabel,
  activeFilters,
  clearFilters,
  search,
  areaResults,
  emptyTitle,
  emptyDescription,
  goToArea,
} = inject(REGISTRY)

const rowEls = new Map()
function registerRow(name, el) {
  if (el) rowEls.set(name, el)
  else rowEls.delete(name) // a row that leaves the list takes its ref with it
}

// A highlight you cannot see is not one: the page asks the panel to scroll the picked row into view.
function reveal(name) {
  nextTick(() =>
    rowEls
      .get(name)
      ?.$el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
  )
}
defineExpose({ reveal })
</script>
