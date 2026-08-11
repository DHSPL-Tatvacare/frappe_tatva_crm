<!-- TATVA: the `Value Map` renderer — one row per blank a template leaves, and what fills it. -->
<template>
  <div>
    <Button
      :label="summary"
      iconLeft="edit-3"
      class="w-full sm:w-auto"
      :disabled="disabled"
      @click="open = true"
    />

    <ResponsiveDialog v-model="open" :options="{ size: '2xl' }">
      <template #body-title>
        <h3 class="text-lg font-semibold text-ink-gray-9">{{ __(label) }}</h3>
      </template>

      <template #body-content>
        <div class="flex flex-col gap-4 overflow-y-auto sm:max-h-[60dvh]">
          <p class="text-p-sm text-ink-gray-6">
            {{
              __(
                'Each of these is a blank the message or the agent leaves. Say what fills it — a value from this run, or text you type. A blank that resolves to nothing is not sent.',
              )
            }}
          </p>

          <!-- Three empty states: the author can act on only one of them. -->
          <p v-if="!source" class="text-p-sm text-ink-gray-5">
            {{ __('Choose one above first — its blanks are what you map here.') }}
          </p>
          <div v-else-if="slots.loading" class="flex items-center gap-2 text-p-sm text-ink-gray-5">
            <LoadingIndicator class="h-4 w-4" />
            {{ __('Reading the blanks…') }}
          </div>
          <ErrorMessage v-else-if="slots.error" :message="__('It could not be read, so its blanks are unknown.')" />
          <p v-else-if="!slotNames.length" class="text-p-sm text-ink-gray-5">
            {{ __('No blanks here. It goes out exactly as written.') }}
          </p>

          <!-- One row per slot, fixed: the template decides how many, never the author. -->
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="name in slotNames"
              :key="name"
              class="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1.4fr)]"
            >
              <code class="truncate rounded bg-surface-gray-2 px-2 py-1 text-xs text-ink-gray-7" :title="name">
                {{ name }}
              </code>
              <FormControl
                type="select"
                :options="modeOptions"
                :modelValue="rowFor(name).mode"
                :disabled="disabled"
                @update:modelValue="(v) => setMode(name, v)"
              />
              <Autocomplete
                v-if="controlFor(rowFor(name).mode) === 'value-picker'"
                :modelValue="rowFor(name).value"
                :options="optionsFor(name)"
                :placeholder="__('Choose a value')"
                :disabled="disabled"
                @update:modelValue="(v) => setValue(name, v?.value ?? null)"
              />
              <FormControl
                v-else
                type="text"
                :placeholder="__('Type the text to send')"
                :modelValue="rowFor(name).value"
                :disabled="disabled"
                @update:modelValue="(v) => setValue(name, v)"
              />
            </div>
          </div>

          <!-- W3.2 — what would really go out, for one real lead. Declared per node, absent means no preview. -->
          <div v-if="preview && source" class="rounded border border-outline-gray-2 bg-surface-gray-1 p-3">
            <div class="mb-2 flex items-center gap-2">
              <div class="text-xs font-medium text-ink-gray-7">{{ __('What would go out') }}</div>
              <div class="flex-1" />
              <Button
                :label="__('Preview')"
                iconLeft="play"
                :loading="probe.loading"
                :disabled="disabled"
                @click="probe.fetch()"
              />
            </div>

            <ErrorMessage v-if="probe.error" :message="probe.error" />
            <p v-else-if="probe.data?.error" class="text-p-sm text-ink-gray-6">{{ probe.data.error }}</p>

            <template v-else-if="probe.data">
              <!-- Reported, never rendered as an empty string: a hole here is a hole a patient would read. -->
              <p v-if="probe.data.blank?.length" class="mb-2 text-p-sm text-ink-amber-3">
                {{ __('{0} resolved to nothing, so this would not be sent.', [probe.data.blank.join(', ')]) }}
              </p>
              <p v-if="probe.data.subject" class="mb-1 text-p-sm font-medium text-ink-gray-8">
                {{ probe.data.subject }}
              </p>
              <!-- v-text, never v-html: a template body is operator content and this panel does not run it. -->
              <p
                v-if="probe.data.body"
                class="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-white p-2 text-p-sm text-ink-gray-7"
                v-text="probe.data.body"
              />
              <div v-if="probe.data.values?.length" class="mt-2 flex flex-col gap-1">
                <div v-for="v in probe.data.values" :key="v.name" class="flex gap-2 text-xs">
                  <code class="shrink-0 rounded bg-surface-gray-2 px-1.5 py-0.5 text-ink-gray-7">{{ v.name }}</code>
                  <span class="truncate text-ink-gray-6">{{ v.value }}</span>
                </div>
              </div>
              <p v-if="probe.data.lead" class="mt-2 text-p-sm text-ink-gray-5">
                {{ __('Built from lead {0}.', [probe.data.lead]) }}
              </p>
            </template>
          </div>
        </div>
      </template>

      <!-- frappe-ui wraps #actions in a PLAIN block div, so opting out of its full-width default without
           supplying alignment dropped this left. The row is the house pattern — TaskModal.vue:310. -->
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button variant="solid" class="w-full sm:w-auto" :label="__('Done')" @click="open = false" />
        </div>
      </template>
    </ResponsiveDialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FormControl, Button, Autocomplete, LoadingIndicator, ErrorMessage, createResource } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { groupedOptions } from '@/tatva/valueOptions'

const props = defineProps({
  label: { type: String, default: 'Values' },
  // The sibling field's value — the template whose blanks these rows fill.
  source: { type: String, default: '' },
  // The method that answers "which blanks does this template have", declared on the field.
  slotsMethod: { type: String, default: '' },
  // Sibling values the slot lookup needs beyond `source` — a voice agent id means nothing without the
  // account it lives on. Named by the declaration (`slots_args`), resolved by the inspector.
  slotsArgs: { type: Object, default: () => ({}) },
  // Declared on the field: the method that fetches a REAL answer. Absent means this control cannot preview.
  preview: { type: Object, default: null },
  // Its sibling arguments, named by the declaration and resolved by the inspector — same rule as slotsArgs.
  previewArgs: { type: Object, default: () => ({}) },
  // The ways a row may be filled, in the CONTRACT's own words — never spelled in this file.
  modes: { type: Array, default: () => [] },
  // {mode: control} from the same declaration. This used to read `modes[1]`, making a mode's meaning its POSITION in a list the backend is free to reorder.
  modeControls: { type: Object, default: () => ({}) },
  // Already-grouped rows from the ONE grouper, so this picker offers what every other picker offers.
  valueRows: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
const model = defineModel({ type: Array, default: () => [] })

const open = ref(false)
const literal = computed(() => props.modes[0] || '')
const modeOptions = computed(() => props.modes.map((m) => ({ label: __(m), value: m })))
const controlFor = (mode) => props.modeControls[mode] || 'data'

// No `cache`: createResource reads it once at construction, so a props-built key would serve stale slots.
const slots = createResource({
  url: props.slotsMethod,
  makeParams: () => ({ template: props.source, ...props.slotsArgs }),
})

// Fetch lazily on open and on template change, resetting first so stale blanks never show under a new name.
// Keyed on the ARGS too, not just `source`: the same agent id under a different account is a different
// agent, and a stale slot list would offer placeholders the new agent never speaks.
const slotKey = computed(() => JSON.stringify([props.source, props.slotsArgs]))
watch([open, slotKey], ([isOpen], [, previousKey]) => {
  if (previousKey !== undefined && previousKey !== slotKey.value) slots.reset()
  if (isOpen && props.source && props.slotsMethod) slots.fetch()
}, { immediate: true })

// Fetched only when the author ASKS (A1/A4) — a preview reaches a live provider and picks a real lead.
const probe = createResource({
  url: props.preview?.method || '',
  makeParams: () => ({ ...props.previewArgs }),
})

// Any edit to the template or the mapping invalidates the answer: a stale preview is a lie about a send.
watch([slotKey, () => JSON.stringify(model.value || [])], () => probe.reset())

const slotNames = computed(() => slots.data || [])
const rows = computed(() => model.value || [])

// A slot with no row yet reads as an empty Literal, the same shape a saved row has.
function rowFor(name) {
  return rows.value.find((r) => r.name === name) || { name, mode: literal.value, value: '' }
}

// Written whole and only for this template's slots; a leftover row reaches a sender that raises on it.
function write(name, patch) {
  model.value = slotNames.value.map((slot) => (slot === name ? { ...rowFor(slot), ...patch } : rowFor(slot)))
}

// Switching mode REPLACES the row: a stale ref would send as text, a stale literal would resolve to nothing.
function setMode(name, mode) {
  write(name, { mode, value: '' })
}

function setValue(name, value) {
  write(name, { value: value ?? '' })
}

// The saved value is passed through, so a reference that no longer exists is shown rather than blanked.
function optionsFor(name) {
  return groupedOptions(props.valueRows, rowFor(name).value)
}

const summary = computed(() => {
  if (!props.source) return __('Map the values')
  // The slots are read when the dialog OPENS (A4), so before that they are UNKNOWN — not zero. Claiming
  // "No values to map" on an unread list told an author their agent had no placeholders while it had two,
  // and the button that would have proved otherwise was the one showing the claim.
  if (!slots.fetched) return __('Map the values')
  const total = slotNames.value.length
  if (!total) return __('No values to map')
  const filled = slotNames.value.filter((n) => rowFor(n).value !== '').length
  // Short on purpose: this label lives in a 288px panel, and the long form ran off the edge.
  return filled === total
    ? __('{0} of {1} mapped', [filled, total])
    : __('{0} of {1} mapped, {2} blank', [filled, total, total - filled])
})
</script>
