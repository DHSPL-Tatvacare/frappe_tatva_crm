<!--
  TATVA: THE export dialog. One component, both surfaces — the native list (ViewControls) and the Smart
  View list — because two copies of one dialog is how they came to disagree: one said "Export Type" and the
  other "Export type", one offered an all-records tick and the other none, one warned about derived fields
  and the other about rows you can see, and only one of them told the truth about its own surface.

  IT DECIDES NOTHING. It reads four numbers a caller already holds — what is on screen, what matched, the
  operator's ceiling, whether a drain is running — and emits the two choices a person made. Which rows the
  server then reads, which permissions apply, which worker drains it and how the file comes back are all
  unchanged and all elsewhere.

  ONE VOCABULARY, TWO CONTRACTS. It emits `excel`/`csv`; the native list endpoint wants `Excel`/`CSV` and
  the Smart View endpoint `xlsx`/`csv`. Each caller maps its own in one line, so the two servers keep the
  arguments they already take and a rep never sees `xlsx` anywhere.

  Built on ResponsiveDialog (C.22): byte-for-byte the stock Dialog on desktop, a bottom sheet on a phone.
-->
<template>
  <ResponsiveDialog
    v-model="show"
    :options="{
      title: __('Export'),
      actions: [
        {
          label: preparing ? __('Preparing…') : __('Download'),
          variant: 'solid',
          // A worker is already draining one; a second click would queue a second job for the same file.
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
        <!-- Only when it BITES. A ceiling nobody is near is noise, and noise is what this replaced. -->
        <template v-if="restricted">
          {{ __('Restricted to the first {0} rows.', [count(rowLimit)]) }}
        </template>
        <!-- Only when this view actually shows one. A derived field has no stored value to write out. -->
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

// `defineModel`, the same way every other modal in `tatva/` takes its open state — the manual
// modelValue/emit pair is the PRIMITIVES' job (ResponsiveDialog, TatvaBottomSheet), not a consumer's.
const show = defineModel({ type: Boolean })

const props = defineProps({
  // Rows the current filters matched — what "all" means, and what the ceiling is measured against.
  total: { type: Number, default: 0 },
  rowLimit: { type: Number, required: true },
  preparing: { type: Boolean, default: false },
  // Whether THIS view shows a derived field — computed by the engine, never stored on the record.
  hasDerived: { type: Boolean, default: false },
})
const emit = defineEmits(['download'])

const FORMATS = [
  { label: __('Excel'), value: 'excel' },
  { label: __('CSV'), value: 'csv' },
]

const format = ref('excel')
// Unticked by default: the file is what the reader is looking at, which is the one answer nobody has to
// be told. Asking for everything is the deliberate act, and it is the one that can hit the ceiling.
const all = ref(false)

// OPENS THE SAME WAY EVERY TIME. The dialog is mounted for the life of the list, so without this a tick
// survives being closed: a rep who once asked for everything finds the box still ticked days later and
// queues a hundred thousand rows without choosing to. Asking for all of it is a decision, and a decision
// made last week is not one made now.
watch(show, (open) => {
  if (!open) return
  format.value = 'excel'
  all.value = false
})

const restricted = computed(() => all.value && props.total > props.rowLimit)
const count = (n) => Number(n || 0).toLocaleString()
</script>
