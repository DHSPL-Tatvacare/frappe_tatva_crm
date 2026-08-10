<!-- TATVA: the `Duration` renderer — how long a Wait waits, as an amount and a unit. NOT the fork's `DurationInput` and not frappe's `Duration` fieldtype: both speak SECONDS and a month is not a fixed number of them, so what is stored here stays the `add_to_date` kwargs the resolver has always been handed, in the units `registry._delay_units` reads off `add_to_date` itself. -->
<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="parsed" class="flex items-center gap-1.5">
      <FormControl
        class="min-w-0 flex-1"
        type="number"
        min="1"
        data-test="duration-amount"
        :placeholder="__('2')"
        :modelValue="parsed.amount"
        :disabled="disabled"
        @update:modelValue="(v) => write(v, parsed.unit)"
      />
      <FormControl
        class="min-w-0 flex-1"
        type="select"
        data-test="duration-unit"
        :options="unitOptions"
        :modelValue="parsed.unit"
        :disabled="disabled"
        @update:modelValue="(v) => write(parsed.amount, v)"
      />
    </div>

    <template v-else>
      <FormControl
        type="text"
        data-test="duration-expression"
        :placeholder="__('{&quot;days&quot;: 14}')"
        :modelValue="model"
        :disabled="disabled"
        @update:modelValue="(v) => (model = v)"
      />
      <p class="text-p-sm text-ink-gray-5">
        {{
          __(
            'This one is worked out as the journey runs, so it is edited as written.',
          )
        }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { parseDelay } from './delay'
import { computed } from 'vue'
import { FormControl } from 'frappe-ui'

const props = defineProps({
  // The units the TYPE declares — `add_to_date`'s own, so this file names none of them.
  units: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
// The stored value IS the `add_to_date` kwargs, as text — the same string the resolver already receives.
const model = defineModel({ type: String, default: '' })

const unitOptions = computed(() =>
  props.units.map((u) => ({ label: __(u), value: u })),
)

// The ONE parser, shared with the canvas card so a delay cannot read two ways (tatva/workflows/delay.js).
const parsed = computed(() => parseDelay(model.value, props.units))

// Written whole, and cleared to nothing when the amount is emptied, so "no delay set" has one representation.
function write(amount, unit) {
  const value = Number(amount)
  if (!value || !unit) {
    model.value = ''
    return
  }
  model.value = JSON.stringify({ [unit]: value })
}
</script>
