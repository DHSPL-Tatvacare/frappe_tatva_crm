<!-- TATVA: the editor for a lead field that takes MORE THAN ONE value (CRM Lead API Field.is_multi_value).
     The model is a plain list of picklist ids — there is no child-row shape here, because the selections
     hang off the LEAD (tatva_connect.lead.multi_value) and not off a column. Options come from the
     server's own `link_query`, forwarded to the Link control's existing `query`/`filters` props: the
     client never derives a category, a grain or a doctype. -->
<template>
  <div
    class="group flex w-full flex-wrap gap-1 rounded bg-surface-gray-2 p-1.5 text-base transition-colors hover:bg-surface-gray-3"
  >
    <Button
      v-for="id in selected"
      :key="id"
      :label="title(id)"
      theme="gray"
      variant="subtle"
      class="max-w-full rounded bg-surface-white hover:!bg-surface-gray-1 [&>span]:min-w-0"
    >
      <template v-if="!disabled" #suffix>
        <FeatherIcon class="h-3.5" name="x" @click.stop="remove(id)" />
      </template>
    </Button>
    <!-- Locked and empty reads "—", the same as every other locked control (activityControls' NOTHING, not imported: this component is one of its rows). -->
    <span v-if="disabled && !selected.length" class="px-1 text-ink-gray-4"
      >—</span
    >
    <div v-if="!disabled" class="w-full">
      <Link
        class="form-control flex-1 cursor-text truncate"
        :doctype="doctype"
        :query="query"
        :filters="filters"
        :value="''"
        :hideMe="true"
        @change="add"
      >
        <!-- Content yields, the control does not (H2): the row of tokens wraps, the picker keeps its line. -->
        <template #target="{ togglePopover }">
          <button class="h-7 w-full cursor-text" @click.stop="togglePopover" />
        </template>
      </Link>
    </div>
  </div>
</template>

<script setup>
import Link from '@/components/Controls/Link.vue'
import {
  ensureLinkTitle,
  knownLinkTitle,
  rememberLinkTitle,
} from '@/tatva/linkTitle'
import { Button, FeatherIcon } from 'frappe-ui'
import { computed, watch } from 'vue'

const props = defineProps({
  // The ids selected, in pick order; one may arrive bare, and a bare string iterates as its characters.
  modelValue: { type: [Array, String], default: () => [] },
  // {id: label} the CALLER already holds, paired by the caller because only it knows which ids its labels belong to.
  titles: { type: Object, default: () => ({}) },
  doctype: { type: String, required: true },
  query: { type: String, default: null },
  filters: { type: [Array, Object, String], default: () => [] },
  // A locked form still shows what was picked; it just offers no way to change it.
  disabled: { type: Boolean, default: false },
  // Declared only to absorb it: every activity control is bound with frappe-ui's variant, which a row of tokens has no use for and which would otherwise land on the div as an attribute.
  variant: { type: String, default: null },
})

const emit = defineEmits(['update:modelValue'])

// One value is a set of ONE — the same rule the writer keeps (tatva_connect.lead.multi_value._as_set).
const asSet = (v) => (Array.isArray(v) ? v : v ? [v] : [])
const selected = computed(() => asSet(props.modelValue))

// The caller's own pairing is authoritative and already fetched, so it seeds the shared map rather than being read positionally — that is what keeps a form open cost NO requests for labels the server already sent.
watch(
  () => [props.doctype, props.titles],
  () => {
    for (const [id, label] of Object.entries(props.titles || {}))
      rememberLinkTitle(props.doctype, id, label)
  },
  { immediate: true },
)

// Resolved by ID, never by position: the server's labels line up with the LEAD's selections, which a task's own answer need not match.
const title = (id) => knownLinkTitle(props.doctype, id) || id

// Only an id NOTHING has a label for is asked, and `ensureLinkTitle` is memoised per (doctype, value) — so this is silent in the normal case (WorkflowNode does the same for its refs).
const scope = computed(() => ({ query: props.query, filters: props.filters }))
watch(
  selected,
  (ids) =>
    ids.forEach(
      (id) =>
        knownLinkTitle(props.doctype, id) ||
        ensureLinkTitle(props.doctype, id, scope.value),
    ),
  { immediate: true },
)

// A selection is a SET: picking the same option twice means what picking it once meant.
function add(id) {
  if (!id || selected.value.includes(id)) return
  emit('update:modelValue', [...selected.value, id])
}

function remove(id) {
  emit(
    'update:modelValue',
    selected.value.filter((v) => v !== id),
  )
}
</script>
