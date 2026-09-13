<!-- TATVA: THE export dialog — one component for the native list and the Smart View list. -->
<template>
  <ResponsiveDialog
    v-model="show"
    :options="{
      title: __('Export'),
      actions: [
        {
          label: preparing ? __('Preparing…') : __('Download'),
          variant: 'solid',
          // A worker is already draining one; a second click queues a second job for the same file.
          disabled: preparing,
          onClick: () => emit('download', { format, all }),
        },
      ],
    }"
  >
    <template #body-content>
      <FormControl
        v-model="format"
        type="select"
        variant="outline"
        :label="__('Export type')"
        :options="FORMATS"
      />
      <div class="mt-3">
        <FormControl
          v-model="all"
          type="checkbox"
          :label="__('All {0} records', [count(total)])"
        />
      </div>
      <p class="mt-3 text-p-sm text-ink-gray-6">
        {{ __('Exports this view as it is — same columns, same filters, same order.') }}
        <!-- Only when it bites: a ceiling nobody is near is the noise this replaced. -->
        <template v-if="restricted">
          {{ __('Restricted to the first {0} rows.', [count(rowLimit)]) }}
        </template>
        <!-- Only where it is true: a derived field has no stored value to write out. -->
        <template v-if="hasDerived">
          {{ __('Derived fields are not included.') }}
        </template>
      </p>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { FormControl } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'

// `defineModel`, as every consumer modal in `tatva/` takes its open state.
const show = defineModel({ type: Boolean })

const props = defineProps({
  // Rows the current filters matched — what "all" means, and what the ceiling is measured against.
  total: { type: Number, default: 0 },
  rowLimit: { type: Number, required: true },
  preparing: { type: Boolean, default: false },
  // Whether this view shows a derived field — computed by the engine, never stored on the record.
  hasDerived: { type: Boolean, default: false },
})
const emit = defineEmits(['download'])

// One vocabulary; each caller maps it to the arguments its own endpoint already takes.
const FORMATS = [
  { label: __('Excel'), value: 'excel' },
  { label: __('CSV'), value: 'csv' },
]

const format = ref('excel')
// Unticked: the file is what the reader is looking at. Asking for everything is the deliberate act.
const all = ref(false)

// Opens the same way every time — the dialog outlives its list, and a stale tick is 100k unasked rows.
watch(show, (open) => {
  if (!open) return
  format.value = 'excel'
  all.value = false
})

const restricted = computed(() => all.value && props.total > props.rowLimit)
const count = (n) => Number(n || 0).toLocaleString()
</script>
