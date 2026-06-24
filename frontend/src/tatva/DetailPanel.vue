<!--
  TATVA: DetailPanel — clean, grain/brain-aware record detail (LSQ-style).

  Generic + prop-driven (doctype/docname/compact): no hardcoded fields or sections. The whole
  projection (which sections, which fields, their values, empty/read_only flags) is resolved
  SERVER-SIDE by tatva_connect.lead.detail.lead_detail — grain-entitled (viewer) and program-world
  applicable (record). This replaces the raw child-table grids on the Data tab and the
  data_tab_gate.js DOM hack.

  Discipline (CLAUDE.md §C):
    * native primitives only (Section / FormControl / Link / Switch / Button / EmptyState),
    * theme tokens (ink-* text, surface-* lines) — never hardcoded hex,
    * values rendered as plain text ({{ }} auto-escapes) — NO v-html (XSS-safe),
    * one createResource, bound to resource.data via computed (no onSuccess copies) → 1× fetch,
    * two-column collapses to one column under sm: (mobile/PWA safe).
-->
<template>
  <div class="flex h-full flex-col">
    <!-- toolbar: hidden in compact (rail) mode -->
    <div
      v-if="!compact"
      class="flex shrink-0 items-center justify-between gap-2 py-3"
    >
      <div class="flex items-center gap-2">
        <Switch v-model="hideEmpty" size="sm" :label="__('Hide Empty Fields')" />
      </div>
      <div class="flex items-center gap-2">
        <template v-if="editing">
          <Button :label="__('Cancel')" @click="cancelEdit" />
          <Button
            variant="solid"
            :label="__('Save')"
            :loading="saving"
            @click="saveEdit"
          />
        </template>
        <Button
          v-else
          :icon-left="'edit-2'"
          :label="__('Edit')"
          @click="startEdit"
        />
      </div>
    </div>

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

    <!-- sections -->
    <div v-else class="flex flex-1 flex-col overflow-y-auto">
      <div
        v-for="(section, i) in sections"
        :key="section.key"
        class="flex flex-col"
      >
        <div v-if="i !== 0" class="h-px w-full border-t border-outline-gray-1" />
        <div class="px-1 py-2 sm:px-3">
          <Section
            :label="section.label"
            :opened="true"
            collapsible
            labelClass="px-2 font-semibold"
            headerClass="h-8"
          >
            <div class="mt-1 flex flex-col">
              <template
                v-for="field in visibleFields(section)"
                :key="field.field_key"
              >
                <div
                  class="flex flex-col gap-0.5 px-3 py-1.5 leading-5 sm:flex-row sm:items-center sm:gap-2"
                >
                  <!-- label -->
                  <Tooltip :text="__(field.label)" :hover-delay="1">
                    <div
                      class="shrink-0 truncate text-sm text-ink-gray-5 sm:w-[35%] sm:min-w-20"
                    >
                      {{ __(field.label) }}
                    </div>
                  </Tooltip>

                  <!-- value -->
                  <div class="min-h-[28px] flex items-center text-base text-ink-gray-8 sm:w-[65%]">
                    <!-- read mode (or a read-only field while editing) -->
                    <span
                      v-if="!editing || field.read_only"
                      class="break-words"
                      :class="{ 'text-ink-gray-4': field.empty }"
                    >
                      {{ displayValue(field) }}
                    </span>

                    <!-- edit mode, writable field -->
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
          </Section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import Section from '@/components/Section.vue'
import Link from '@/components/Controls/Link.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import {
  createResource,
  call,
  Tooltip,
  Button,
  FormControl,
  Switch,
  DatePicker,
  DateTimePicker,
  LoadingIndicator,
} from 'frappe-ui'
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  doctype: { type: String, default: 'CRM Lead' },
  docname: { type: String, required: true },
  // compact = the right rail: read-only, no toolbar, empties always hidden.
  compact: { type: Boolean, default: false },
})

const TEXTAREA_TYPES = ['Small Text', 'Text', 'Long Text', 'Code']

// ONE resource, bound via computed (no onSuccess copy). The lead page's keyed router-view remounts
// this panel several times as the tab/route settles; `cache` keyed on the lead makes every remount
// after the first a cache hit (zero extra network) — the native DataFields storm-defense (CLAUDE.md
// C.3/C.4). Edit-save calls reload(), which forces a fresh network fetch and refreshes the cache.
const panel = createResource({
  url: 'tatva_connect.lead.detail.lead_detail',
  cache: ['tatva-lead-detail', props.docname],
  makeParams: () => ({ lead: props.docname }),
  auto: true,
})

const sections = computed(() => panel.data?.sections || [])

const hideEmpty = ref(true) // default ON
const editing = ref(false)
const saving = ref(false)
const draft = reactive({}) // { field_key: value } — only touched fields

function visibleFields(section) {
  const hide = props.compact || (hideEmpty.value && !editing.value)
  return section.fields.filter((f) => !(hide && f.empty))
}

function displayValue(field) {
  const v = field.field_key in draft ? draft[field.field_key] : field.value
  if (v === null || v === undefined || v === '') return '—'
  if (field.fieldtype === 'Check') return v ? __('Yes') : __('No')
  return String(v)
}

function selectOptions(field) {
  const raw = (field.options || '').split('\n')
  return raw.map((o) => ({ label: o, value: o }))
}

// A tiny get/set proxy so v-model writes land in `draft`, defaulting to the server value.
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
  // Only fields actually changed from their server value.
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
