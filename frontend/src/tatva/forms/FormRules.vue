<!-- TATVA: Task Forms Rules tab — one card per rule (`ruleCards`), read in the form's own question labels. -->
<template>
  <div class="flex flex-col gap-5.5">
    <p class="text-sm text-ink-gray-5">
      {{ __("Rules decide what shows, what's required and what's copied. Order does not matter.") }}
    </p>
    <div
      v-if="!cards.length"
      class="flex min-h-20 items-center justify-center rounded border-2 border-dashed border-outline-gray-2 text-sm text-ink-gray-4"
    >
      {{ __('This form has no rules.') }}
    </div>
    <div
      v-for="card in cards"
      :key="card.rows[0].name"
      class="flex flex-col gap-1.5 rounded bg-surface-gray-2 p-2.5"
    >
      <div class="flex h-7 items-center text-base font-medium text-ink-gray-9">
        {{ card.rows[0].rule_label || __('When the form opens') }}
      </div>
      <div class="flex flex-col gap-1.5 rounded border border-dashed border-outline-gray-2 bg-surface-modal p-2 text-base text-ink-gray-8">
        <div class="flex gap-2">
          <span class="w-14 shrink-0 text-ink-gray-5">{{ __('When') }}</span>
          <span>{{ whenText(card.rows[0]) }}</span>
        </div>
        <div v-for="row in card.rows" :key="row.name" class="flex gap-2">
          <span class="w-14 shrink-0 text-ink-gray-5">{{ __('Then') }}</span>
          <span class="min-w-0">
            <span class="font-medium">{{ __(row.action) }}</span>
            {{ (targets[row.name] || []).map(labelOf).join(', ') }}
            <template v-if="row.set_value"> ← {{ labelOf(row.set_value) }}</template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { toCards } from './ruleCards'
import { arityOf } from '@/tatva/fieldControl'
import { computed } from 'vue'

const props = defineProps({
  rules: { type: Array, required: true },
  schema: { type: Array, required: true },
  // `builder_doc`'s targets, read by the server's `rule_targets` — never split here.
  targets: { type: Object, required: true },
})

const cards = computed(() => toCards(props.rules))
const labels = computed(() => new Map(props.schema.map((r) => [r.fieldname, r.label || r.fieldname])))
const labelOf = (fieldname) => labels.value.get(fieldname) || fieldname

// The row's two triplets, ANDed as the engine reads them; none is the form's opening state.
function whenText(row) {
  const parts = [
    [row.condition_field, row.operator, row.condition_value],
    [row.condition_field_2, row.operator_2, row.condition_value_2],
  ]
    .filter(([field]) => field)
    .map(([field, operator, value]) =>
      [labelOf(field), __(operator || 'is'), arityOf(operator) === 'none' ? '' : value]
        .filter(Boolean)
        .join(' '),
    )
  return parts.length ? parts.join(` ${__('and')} `) : __('the form opens')
}
</script>
