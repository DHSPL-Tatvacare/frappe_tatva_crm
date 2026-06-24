<!-- TATVA: clean grain/brain-aware record detail; sections/fields/order/values resolved server-side by tatva_connect.lead.detail.lead_detail. Native two-column rows (SidePanelLayout pattern), tokens, plain-text values (no v-html), one createResource, gutter from the tab wrapper. -->
<template>
  <div class="flex h-full flex-col">
    <template v-if="!compact">
      <!-- header: "Data" title (like the other tabs) · 3-dot options + Edit -->
      <div class="my-3 flex shrink-0 items-center justify-between sm:mb-4 sm:mt-8">
        <div class="flex h-8 items-center text-xl font-semibold text-ink-gray-8">
          {{ __('Data') }}
        </div>
        <div class="flex items-center gap-1">
          <Popover>
            <template #target="{ togglePopover }">
              <Button
                icon="more-horizontal"
                variant="ghost"
                :tooltip="__('Options')"
                @click="togglePopover"
              />
            </template>
            <template #body-main>
              <div class="w-56 p-2">
                <div class="flex items-center justify-between rounded px-2 py-1.5">
                  <span class="text-sm text-ink-gray-7">{{ __('Hide empty fields') }}</span>
                  <Switch v-model="hideEmpty" size="sm" />
                </div>
                <button
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-ink-gray-7 hover:bg-surface-gray-2"
                  @click="toggleAll"
                >
                  <FeatherIcon
                    :name="allOpen ? 'chevrons-up' : 'chevrons-down'"
                    class="h-4 w-4 text-ink-gray-5"
                  />
                  {{ allOpen ? __('Collapse all') : __('Expand all') }}
                </button>
              </div>
            </template>
          </Popover>
          <template v-if="editing">
            <Button :label="__('Cancel')" @click="cancelEdit" />
            <Button variant="solid" :label="__('Save')" :loading="saving" @click="saveEdit" />
          </template>
          <Button v-else variant="solid" :label="__('Edit')" @click="startEdit" />
        </div>
      </div>

      <!-- search, on its own row below the header -->
      <div class="mb-3 shrink-0">
        <FormControl
          v-model="query"
          type="text"
          :placeholder="__('Search fields…')"
          class="w-full sm:w-72"
        >
          <template #prefix>
            <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
          </template>
        </FormControl>
      </div>
    </template>

    <!-- states -->
    <div v-if="panel.loading" class="flex flex-1 items-center justify-center">
      <LoadingIndicator class="h-6 w-6 text-ink-gray-5" />
    </div>
    <EmptyState
      v-else-if="panel.error"
      name="detail-error"
      :title="__('Could not load details')"
      :description="String(panel.error.messages?.[0] || panel.error)"
      icon="alert-triangle"
    />
    <EmptyState
      v-else-if="!sections.length"
      name="detail-empty"
      :title="__('No details to show')"
      :description="__('This record has no fields you can view here.')"
      icon="file-text"
    />

    <!-- sections (FadedScrollableDiv = native hidden-scrollbar scroll) -->
    <FadedScrollableDiv v-else class="flex flex-1 flex-col gap-1 overflow-y-auto">
      <section v-for="section in visibleSections" :key="section.key" class="flex flex-col">
        <!-- group header (controlled collapse) -->
        <button
          class="flex h-8 items-center gap-2 text-base font-semibold text-ink-gray-8"
          @click="toggle(section.key)"
        >
          <FeatherIcon
            name="chevron-right"
            class="h-4 w-4 shrink-0 text-ink-gray-5 transition-transform duration-200"
            :class="{ 'rotate-90': isOpen(section.key) }"
          />
          <span>{{ __(section.label) }}</span>
        </button>

        <!-- group body: LSQ-style 2-column grid, label above value -->
        <div
          v-show="isOpen(section.key)"
          class="grid grid-cols-1 gap-x-10 gap-y-3 py-2 sm:grid-cols-2"
        >
          <template v-for="field in visibleFields(section)" :key="field.field_key">
            <div class="flex flex-col gap-0.5">
              <div class="text-sm text-ink-gray-5">{{ __(field.label) }}</div>

              <div class="flex min-h-[24px] items-center text-base text-ink-gray-8">
                <span
                  v-if="!editing || field.read_only"
                  class="break-words"
                  :class="{ 'text-ink-gray-4': field.empty }"
                >
                  {{ displayValue(field) }}
                </span>
                <FormControl
                  v-else-if="field.fieldtype === 'Check'"
                  type="checkbox"
                  :modelValue="Boolean(model(field).value)"
                  @update:modelValue="model(field).value = $event"
                />
                <FormControl
                  v-else-if="field.fieldtype === 'Select'"
                  class="w-full"
                  type="select"
                  :options="selectOptions(field)"
                  :modelValue="model(field).value"
                  @update:modelValue="model(field).value = $event"
                />
                <FormControl
                  v-else-if="TEXTAREA_TYPES.includes(field.fieldtype)"
                  class="w-full"
                  type="textarea"
                  :modelValue="model(field).value"
                  @update:modelValue="model(field).value = $event"
                />
                <DatePicker
                  v-else-if="field.fieldtype === 'Date'"
                  class="w-full"
                  :value="model(field).value"
                  @change="(v) => (model(field).value = v)"
                />
                <DateTimePicker
                  v-else-if="field.fieldtype === 'Datetime'"
                  class="w-full"
                  :value="model(field).value"
                  @change="(v) => (model(field).value = v)"
                />
                <Link
                  v-else-if="field.fieldtype === 'Link'"
                  class="w-full"
                  :doctype="field.options"
                  :value="model(field).value"
                  @change="(v) => (model(field).value = v)"
                />
                <FormControl
                  v-else
                  class="w-full"
                  type="text"
                  :modelValue="model(field).value"
                  @update:modelValue="model(field).value = $event"
                />
              </div>
            </div>
          </template>
        </div>
      </section>
    </FadedScrollableDiv>
  </div>
</template>

<script setup>
import Link from '@/components/Controls/Link.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import {
  createResource,
  call,
  Button,
  FormControl,
  Popover,
  Switch,
  DatePicker,
  DateTimePicker,
  FeatherIcon,
  LoadingIndicator,
} from 'frappe-ui'
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  doctype: { type: String, default: 'CRM Lead' },
  docname: { type: String, required: true },
  compact: { type: Boolean, default: false },
})

const TEXTAREA_TYPES = ['Small Text', 'Text', 'Long Text', 'Code']

// One resource bound via computed; `cache` makes the tab-settle remounts cache hits (native DataFields storm-defense, CLAUDE.md C.3/C.4); reload() on save refreshes it.
const panel = createResource({
  url: 'tatva_connect.lead.detail.lead_detail',
  cache: ['tatva-lead-detail', props.docname],
  makeParams: () => ({ lead: props.docname }),
  auto: true,
})

const sections = computed(() => panel.data?.sections || [])

const hideEmpty = ref(true) // default ON
const query = ref('') // client-side field search (label match) — no backend, no new surface
const editing = ref(false)
const saving = ref(false)
const draft = reactive({}) // { field_key: value } — only touched fields

// collapse controlled here so it survives the tab-settle remounts
const closed = reactive({}) // section.key -> true when collapsed
const isOpen = (key) => !closed[key]
const toggle = (key) => (closed[key] = !closed[key])
const allOpen = computed(() => sections.value.every((s) => isOpen(s.key)))
function toggleAll() {
  const collapse = allOpen.value
  for (const s of sections.value) closed[s.key] = collapse
}

function visibleFields(section) {
  const hideEmptyOn = props.compact || (hideEmpty.value && !editing.value)
  const q = query.value.trim().toLowerCase()
  return section.fields.filter((f) => {
    if (hideEmptyOn && f.empty) return false
    if (q && !String(f.label || '').toLowerCase().includes(q)) return false
    return true
  })
}
const visibleSections = computed(() =>
  sections.value.filter((s) => visibleFields(s).length),
)

function displayValue(field) {
  const v = field.field_key in draft ? draft[field.field_key] : field.value
  if (v === null || v === undefined || v === '') return '—'
  if (field.fieldtype === 'Check') return v ? __('Yes') : __('No')
  return String(v)
}

function selectOptions(field) {
  return (field.options || '').split('\n').map((o) => ({ label: o, value: o }))
}

function model(field) {
  return {
    get value() {
      return field.field_key in draft ? draft[field.field_key] : field.value
    },
    set value(v) {
      draft[field.field_key] = v
    },
  }
}

function startEdit() {
  for (const k of Object.keys(draft)) delete draft[k]
  editing.value = true
}

function cancelEdit() {
  for (const k of Object.keys(draft)) delete draft[k]
  editing.value = false
}

async function saveEdit() {
  const flat = {}
  for (const s of sections.value) for (const f of s.fields) flat[f.field_key] = f
  const changes = {}
  for (const [fk, v] of Object.entries(draft)) {
    if (flat[fk] && v !== flat[fk].value) changes[fk] = v
  }
  if (!Object.keys(changes).length) {
    cancelEdit()
    return
  }
  saving.value = true
  try {
    await call('tatva_connect.lead.detail.update_lead_detail', {
      lead: props.docname,
      changes: JSON.stringify(changes),
    })
    await panel.reload()
    cancelEdit()
  } finally {
    saving.value = false
  }
}
</script>
