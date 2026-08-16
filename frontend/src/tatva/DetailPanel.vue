<!-- TATVA: clean grain/brain-aware record detail; sections/fields/order/values resolved server-side by tatva_connect.lead.detail.lead_detail. Native two-column rows (SidePanelLayout pattern), tokens, plain-text values (no v-html), one createResource, gutter from the tab wrapper. -->
<template>
  <div class="flex h-full flex-col">
    <template v-if="!compact">
      <!-- header (one row): "Data" title · search (right of the title) · 3-dot + Edit (far right) -->
      <div class="my-3 flex shrink-0 items-center gap-3 sm:mb-4 sm:mt-8">
        <div
          class="flex h-8 shrink-0 items-center text-xl font-semibold text-ink-gray-8"
        >
          {{ __('Data') }}
          <!-- same dirty affordance as the native Data tab (Activities/DataFields.vue) -->
          <Badge
            v-if="isDirty"
            class="ml-3"
            :label="__('Not Saved')"
            theme="orange"
          />
        </div>
        <FormControl
          v-model="query"
          type="text"
          :placeholder="__('Search fields…')"
          class="w-40 sm:w-64"
        >
          <template #prefix>
            <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
          </template>
        </FormControl>
        <div class="ml-auto flex items-center gap-1">
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
                <div
                  class="flex items-center justify-between rounded px-2 py-1.5"
                >
                  <span class="text-sm text-ink-gray-7">{{
                    __('Hide empty fields')
                  }}</span>
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
          <!-- TATVA: a read-only panel says so instead of offering an Edit that the server would refuse. -->
          <span
            v-if="readOnly"
            class="text-sm text-ink-gray-5"
            >{{ __('Read-only — edit these on the lead') }}</span
          >
          <template v-else-if="editing">
            <Button :label="__('Cancel')" @click="cancelEdit" />
            <!-- disabled until dirty, exactly like the native Data tab's Save -->
            <Button
              variant="solid"
              :label="__('Save')"
              :disabled="!isDirty"
              :loading="saving"
              @click="saveEdit"
            />
          </template>
          <Button
            v-else
            variant="solid"
            :label="__('Edit')"
            @click="startEdit"
          />
        </div>
      </div>
    </template>

    <!-- states -->
    <!-- the native Data tab's loading state (Activities/DataFields.vue), verbatim -->
    <div
      v-if="panel.loading"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-xl font-medium text-ink-gray-6"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span>{{ __('Loading...') }}</span>
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
    <FadedScrollableDiv
      v-else
      class="flex flex-1 flex-col gap-1 overflow-y-auto"
    >
      <section
        v-for="section in visibleSections"
        :key="section.key"
        class="flex flex-col"
      >
        <!-- group header (controlled collapse). The View more cluster is a SIBLING of the collapse
             button, never inside it (H1) — a button in a button is not clickable. -->
        <div class="flex h-8 items-center gap-2">
          <button
            class="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold text-ink-gray-8"
            @click="toggle(section.key)"
          >
            <FeatherIcon
              name="chevron-right"
              class="h-4 w-4 shrink-0 text-ink-gray-5 transition-transform duration-200"
              :class="{ 'rotate-90': isOpen(section.key) }"
            />
            <!-- Content yields, controls do not (H2): the title truncates, the button keeps its size. -->
            <span class="truncate">{{ __(section.label) }}</span>
          </button>
          <!-- A section IS a child table, so "more" belongs to the SECTION once — not to each of its
               fields, which is one button per cell all opening one column of the same rows. Stock
               secondary Button, pinned to the right end of every section header alike. -->
          <Button
            v-if="section.multi_row && section.row_count > 1"
            class="shrink-0"
            :label="__('View more')"
            @click="openRows(section)"
          >
            <template #suffix>
              <Badge variant="subtle" theme="gray" :label="String(section.row_count)" />
            </template>
          </Button>
        </div>

        <!-- group body: 2-column grid, label above value, one separator under each row. `divide-y` cannot be
             used on a grid — it borders every child but the first, which lines the RIGHT cell of each row too;
             a per-cell `border-b` in the same token is what draws one continuous line across the row. -->
        <div
          v-show="isOpen(section.key)"
          class="grid grid-cols-1 gap-x-10 sm:grid-cols-2"
        >
          <template
            v-for="field in visibleFields(section)"
            :key="field.field_key"
          >
            <div
              class="flex flex-col gap-0.5 border-b border-outline-gray-modals py-2.5"
            >
              <div class="text-sm text-ink-gray-5">{{ __(field.label) }}</div>

              <div
                class="flex min-h-[24px] items-center text-base text-ink-gray-8"
              >
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
                <!-- A field that takes more than one value: the SAME scoped picker, many times over.
                     Checked before the Link branch, because a multi-value field IS a Link at the
                     picklist master — what differs is how many of them the field holds. -->
                <MultiValueInput
                  v-else-if="field.multi_value"
                  class="w-full"
                  :doctype="field.options"
                  :query="field.link_query?.query"
                  :filters="field.link_query?.filters"
                  :titles="pairTitles(field.value, field.display)"
                  :modelValue="model(field).value || []"
                  @update:modelValue="model(field).value = $event"
                />
                <!-- query/filters come from the server's own link_query; the client derives neither. -->
                <Link
                  v-else-if="field.fieldtype === 'Link'"
                  class="w-full"
                  :doctype="field.options"
                  :query="field.link_query?.query"
                  :filters="field.link_query?.filters"
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
                <!-- Sits AFTER the control chain, never inside it: a v-if here would re-parent every
                     v-else-if below to this button and a field with history would lose its editor. -->
                <Button
                  v-if="field.has_more"
                  variant="ghost"
                  size="sm"
                  :label="__('More')"
                  class="ml-2 shrink-0"
                  @click="openHistory(field)"
                />
              </div>
            </div>
          </template>
        </div>
      </section>
    </FadedScrollableDiv>

    <!-- v-if, not just v-model: a fresh open is a fresh instance, and nothing fetches while closed. -->
    <SectionHistoryModal
      v-if="historyField"
      v-model="historyOpen"
      :lead="panelLead"
      :field-key="historyField"
      @update:modelValue="
        (open) => {
          if (!open) historyField = ''
        }
      "
    />
    <SectionRowsModal
      v-if="rowsSection"
      v-model="rowsOpen"
      :lead="panelLead"
      :section="rowsSection"
      :doctype="rowsDoctype"
      :label="rowsLabel"
      @update:modelValue="
        (open) => {
          if (!open) rowsSection = ''
        }
      "
    />
  </div>
</template>

<script setup>
import Link from '@/components/Controls/Link.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import MultiValueInput from '@/tatva/MultiValueInput.vue'
import { pairTitles } from '@/tatva/linkTitle'
import SectionHistoryModal from '@/tatva/SectionHistoryModal.vue'
import SectionRowsModal from '@/tatva/SectionRowsModal.vue'
import {
  createResource,
  call,
  Badge,
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
  cache: ['tatva-lead-detail', props.doctype, props.docname],
  makeParams: () => ({ lead: props.docname, doctype: props.doctype }),
  auto: true,
})

const sections = computed(() => panel.data?.sections || [])

// TATVA: a Deal is served its LEAD's panel (`deal.lead`), so the server hands the resolved lead back and every follow-up read addresses that, never the deal id.
const panelLead = computed(() => panel.data?.lead || props.docname)

// TATVA: the server decides editability — a Deal's panel is read-only this phase, because the write allowlist is built for a lead.
const readOnly = computed(() => !!panel.data?.read_only)

// The field whose history is open. Held rather than derived: it is what keys the modal instance, so a
// second question opens a NEW instance with its own cache key instead of reusing the first one's.
const historyField = ref('')
const historyOpen = ref(false)

function openHistory(field) {
  historyField.value = field.field_key
  historyOpen.value = true
}

// The section whose rows are open. Held rather than derived, for the same reason as historyField: it
// keys the modal instance, so a second section opens a NEW instance instead of reusing the first's.
const rowsSection = ref('')
const rowsLabel = ref('')
const rowsDoctype = ref('')
const rowsOpen = ref(false)

function openRows(section) {
  rowsSection.value = section.key
  rowsLabel.value = section.label
  rowsDoctype.value = section.doctype
  rowsOpen.value = true
}

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
    if (
      q &&
      !String(f.label || '')
        .toLowerCase()
        .includes(q)
    )
      return false
    return true
  })
}
const visibleSections = computed(() =>
  sections.value.filter((s) => visibleFields(s).length),
)

// Dirty is DERIVED by diffing the draft against the served values — the native Data tab's shape
// (DataFields.vue diffs document.doc against document.originalDoc to drive isDirty and its Save button).
const fieldsByKey = computed(() => {
  const flat = {}
  for (const s of sections.value)
    for (const f of s.fields) flat[f.field_key] = f
  return flat
})
// A multi-value value is a LIST and a fresh one is never `===` the served one, so comparing identity would call every panel dirty after a token was added and removed again (E1).
function same(a, b) {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => v === b[i])
  return a === b
}
const changes = computed(() => {
  const out = {}
  for (const [fk, v] of Object.entries(draft)) {
    const f = fieldsByKey.value[fk]
    if (f && !same(v, f.value)) out[fk] = v
  }
  return out
})
const isDirty = computed(() => Object.keys(changes.value).length > 0)

function displayValue(field) {
  const inDraft = field.field_key in draft
  const v = inDraft ? draft[field.field_key] : field.value
  if (v === null || v === undefined || v === '') return '—'
  // A multi-value field reads as its selections on one line — the server's labels, or the ids mid-edit where the reader is looking at the tokens instead.
  if (Array.isArray(v))
    return v.length ? (!inDraft && field.display ? field.display : v).join(', ') : '—'
  if (field.fieldtype === 'Check') return v ? __('Yes') : __('No')
  // Link/composite-PK: show the server-resolved clean label (display_label) for the stored value —
  // same source as TatvaStagePill; the `::` PK never reaches the UI. (Not for a mid-edit draft pick.)
  if (!inDraft && field.display) return field.display
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
  if (!isDirty.value) return
  saving.value = true
  try {
    await call('tatva_connect.lead.detail.update_lead_detail', {
      lead: panelLead.value,
      changes: JSON.stringify(changes.value),
    })
    await panel.reload()
    cancelEdit()
  } finally {
    saving.value = false
  }
}
</script>
