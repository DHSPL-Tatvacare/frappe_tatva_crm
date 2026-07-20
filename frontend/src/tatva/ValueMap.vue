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
        <div class="flex flex-col gap-4 overflow-y-auto sm:max-h-[60vh]">
          <p class="text-p-sm text-ink-gray-6">
            {{
              __(
                'The template leaves a blank for each of these. Say what fills it — a value from this run, or text you type. A blank that resolves to nothing is not sent.',
              )
            }}
          </p>

          <!-- Three empty states: the author can act on only one of them. -->
          <p v-if="!source" class="text-p-sm text-ink-gray-5">
            {{ __('Choose a template first — its blanks are what you map here.') }}
          </p>
          <div v-else-if="slots.loading" class="flex items-center gap-2 text-p-sm text-ink-gray-5">
            <LoadingIndicator class="h-4 w-4" />
            {{ __('Reading the template…') }}
          </div>
          <ErrorMessage v-else-if="slots.error" :message="__('The template could not be read, so its blanks are unknown.')" />
          <p v-else-if="!slotNames.length" class="text-p-sm text-ink-gray-5">
            {{ __('This template has no blanks. It sends exactly as written.') }}
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
                v-if="rowFor(name).mode === fromContext"
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
        </div>
      </template>

      <template #actions>
        <Button variant="solid" class="w-full sm:w-auto" :label="__('Done')" @click="open = false" />
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
  // The two ways a row may be filled, in the CONTRACT's own words — never spelled in this file.
  modes: { type: Array, default: () => [] },
  // Already-grouped rows from the ONE grouper, so this picker offers what every other picker offers.
  valueRows: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
const model = defineModel({ type: Array, default: () => [] })

const open = ref(false)
const literal = computed(() => props.modes[0] || '')
const fromContext = computed(() => props.modes[1] || '')
const modeOptions = computed(() => props.modes.map((m) => ({ label: __(m), value: m })))

// No `cache`: createResource reads it once at construction, so a props-built key would serve stale slots.
const slots = createResource({
  url: props.slotsMethod,
  makeParams: () => ({ template: props.source }),
})

// Fetch lazily on open and on template change, resetting first so stale blanks never show under a new name.
watch([open, () => props.source], ([isOpen], [wasOpen, previousSource]) => {
  if (previousSource !== undefined && previousSource !== props.source) slots.reset()
  if (isOpen && props.source && props.slotsMethod) slots.fetch()
}, { immediate: true })

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
  if (!props.source) return __('Map the template values')
  const total = slotNames.value.length
  if (!total) return __('No values to map')
  const filled = slotNames.value.filter((n) => rowFor(n).value !== '').length
  return filled === total
    ? __('{0} of {1} values mapped', [filled, total])
    : __('{0} of {1} values mapped — {2} still blank', [filled, total, total - filled])
})
</script>
