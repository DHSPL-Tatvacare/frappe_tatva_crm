<!-- TATVA: node inspector (right panel). Fields are rendered from the CRM Workflow Node DocType meta
     (getMeta) and shown/hidden by the doctype's OWN depends_on strings (evaluateDependsOnValue) — so the
     inspector is a live mirror of the Desk form and can never drift. It authors config only; edges are
     drawn on the canvas, so the 5 edge fields are excluded here. -->
<template>
  <aside class="flex w-72 shrink-0 flex-col border-l border-outline-gray-2 bg-surface-white">
    <header
      class="flex items-center justify-between border-b border-outline-gray-2 px-4 py-3"
    >
      <div class="flex items-center gap-2">
        <span
          class="flex h-5 w-5 items-center justify-center rounded"
          :class="styleFor(node.node_type).chip"
        >
          <component :is="iconFor(node.node_type)" class="h-3 w-3" />
        </span>
        <span class="text-sm font-semibold text-ink-gray-8">{{ __('Node') }}</span>
      </div>
      <button
        class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2"
        @click="$emit('close')"
      >
        <LucideX class="h-4 w-4" />
      </button>
    </header>

    <div class="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
      <div>
        <div class="mb-1 text-xs font-medium text-ink-gray-6">{{ __('Node ID') }}</div>
        <div class="text-sm font-medium text-ink-gray-8">{{ node.node_id }}</div>
      </div>

      <div>
        <div class="mb-1 text-xs font-medium text-ink-gray-6">{{ __('Type') }}</div>
        <FormControl
          type="select"
          :options="typeOptions"
          :modelValue="node.node_type"
          :disabled="!editable"
          @update:modelValue="onTypeChange"
        />
      </div>

      <div v-for="f in visibleFields" :key="f.fieldname">
        <div class="mb-1 text-xs font-medium text-ink-gray-6">
          {{ f.label }}
          <span v-if="f.reqd" class="text-ink-red-2">*</span>
        </div>
        <Link
          v-if="f.fieldtype === 'Link'"
          :doctype="f.options"
          :value="node[f.fieldname] || ''"
          :disabled="!editable"
          @change="(v) => setField(f.fieldname, v)"
        />
        <FormControl
          v-else-if="f.fieldtype === 'Select'"
          type="select"
          :options="f.options"
          :modelValue="node[f.fieldname]"
          :disabled="!editable"
          @update:modelValue="(v) => setField(f.fieldname, v)"
        />
        <FormControl
          v-else-if="CODE_TYPES.includes(f.fieldtype)"
          type="textarea"
          :rows="f.fieldtype === 'Code' ? 3 : 2"
          :modelValue="node[f.fieldname]"
          :disabled="!editable"
          :placeholder="f.description || ''"
          @update:modelValue="(v) => setField(f.fieldname, v)"
        />
        <FormControl
          v-else
          type="text"
          :modelValue="node[f.fieldname]"
          :disabled="!editable"
          :placeholder="f.description || ''"
          @update:modelValue="(v) => setField(f.fieldname, v)"
        />
      </div>

      <p
        v-if="!visibleFields.length"
        class="pt-1 text-xs leading-snug text-ink-gray-4"
      >
        {{ __('This node type has no parameters. Connect its handles on the canvas.') }}
      </p>
    </div>
  </aside>
</template>
<script setup>
import { computed } from 'vue'
import { FormControl } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import { getMeta } from '@/stores/meta'
import { evaluateDependsOnValue } from '@/utils/expressions'
import { NODE_TYPES, styleFor, iconFor } from './nodeCatalog'
import LucideX from '~icons/lucide/x'

const props = defineProps({
  node: { type: Object, required: true },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'shape-change'])

const CODE_TYPES = ['Code', 'Small Text', 'Text', 'Long Text']
// Edges are drawn on the canvas, node_id is immutable, node_type has its own control — exclude all here.
const EXCLUDE = new Set([
  'node_id',
  'node_type',
  'next_node',
  'on_true',
  'on_false',
  'on_event',
  'on_timeout',
])

const { getFields, doctypeMeta } = getMeta('CRM Workflow Node')

const typeOptions = NODE_TYPES.map((t) => ({ label: t.label, value: t.type }))

const configFields = computed(() =>
  doctypeMeta.value ? getFields().filter((f) => !EXCLUDE.has(f.fieldname)) : [],
)

// Show/hide by the doctype's OWN depends_on (e.g. eval:doc.node_type=="Step") against the live node.
const visibleFields = computed(() =>
  configFields.value.filter(
    (f) => !f.depends_on || evaluateDependsOnValue(f.depends_on, props.node),
  ),
)

function setField(fieldname, value) {
  props.node[fieldname] = value
  // wait_mode changes which output handles a Wait node has → let the canvas prune now-invalid edges.
  if (fieldname === 'wait_mode') emit('shape-change')
}

function onTypeChange(value) {
  props.node.node_type = value
  emit('shape-change')
}
</script>
