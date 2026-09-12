<!--
  TATVA: PredicateGroup — the MOLECULE that nests. One group: its joiner, its children, its add controls.

  IT OWNS ITS OWN SUBTREE. The node is a v-model, so a group edits its children and hands the whole group
  back up; the parent neither knows nor cares what changed inside. That is what lets the component render
  ITSELF for a child group without any path bookkeeping — the alternative, bubbling (index, change) pairs
  through every level, is the thing that makes nested editors rot.

  A flat host caps `maxDepth` at 1 and never sees a nested group; a host that needs "A and (B or C)"
  raises the cap and gets it here. No host re-implements nesting.
-->
<template>
  <div class="rounded border border-outline-gray-2 bg-surface-gray-1 p-2.5">
    <div class="mb-2 flex items-center gap-2">
      <PredicateJoiner
        :modelValue="op"
        :options="c.value.joinerOptions"
        :disabled="c.value.disabled"
        @update:modelValue="setOp"
      />
      <span class="text-xs text-ink-gray-5">{{ c.value.hintFor(op) }}</span>
      <div class="flex-1" />
      <Button
        v-if="removable"
        variant="ghost"
        icon="x"
        :label="''"
        :disabled="c.value.disabled"
        @click="emit('remove')"
      />
    </div>

    <div class="flex flex-col gap-2 pl-2">
      <template v-for="(child, i) in node.conditions" :key="i">
        <PredicateGroup
          v-if="isGroup(child)"
          :modelValue="child"
          :depth="depth + 1"
          removable
          @update:modelValue="(v) => replaceChild(i, v)"
          @remove="removeChild(i)"
        >
          <template #value="slotProps"><slot name="value" v-bind="slotProps" /></template>
        </PredicateGroup>
        <PredicateCondition
          v-else
          :node="child"
          :invalid="c.value.isIncomplete(child)"
          @update:node="(v) => replaceChild(i, v)"
          @remove="removeChild(i)"
        >
          <template #value="slotProps"><slot name="value" v-bind="slotProps" /></template>
        </PredicateCondition>
      </template>
    </div>

    <div class="mt-2 flex gap-2 pl-2">
      <Button
        variant="ghost"
        iconLeft="plus"
        class="!text-ink-gray-6"
        :label="__('Add condition')"
        :disabled="c.value.disabled || !c.value.fields.length"
        @click="addCondition"
      />
      <!-- Offered only while the host allows another level, so a flat host never shows a control that
           would build a tree it cannot store. -->
      <Button
        v-if="depth + 1 < c.value.maxDepth"
        variant="ghost"
        iconLeft="plus"
        class="!text-ink-gray-6"
        :label="__('Add group')"
        :disabled="c.value.disabled || !c.value.fields.length"
        @click="addGroup"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Button } from 'frappe-ui'
import PredicateJoiner from './PredicateJoiner.vue'
import PredicateCondition from './PredicateCondition.vue'
import { PREDICATE_CONTEXT } from './context'
import { isGroup, opOf, emptyGroup } from './predicateTree'

defineOptions({ name: 'PredicateGroup' })

defineProps({
  depth: { type: Number, default: 0 },
  removable: { type: Boolean, default: false },
})
const emit = defineEmits(['remove'])
const node = defineModel({ type: Object, required: true })

const ctx = inject(PREDICATE_CONTEXT)
const c = computed(() => ctx.value)
const op = computed(() => opOf(node.value))

// Every edit REPLACES the group. Nothing here mutates the node it was handed — the host owns that object
// and a mutation in place is how two surfaces end up disagreeing about what the model currently is.
function patch(conditions, nextOp = op.value) {
  node.value = { ...node.value, op: nextOp, conditions }
}
function setOp(v) {
  patch(node.value.conditions, v)
}
function replaceChild(i, v) {
  patch(node.value.conditions.map((c, j) => (j === i ? v : c)))
}
function removeChild(i) {
  patch(node.value.conditions.filter((_, j) => j !== i))
}
function addCondition() {
  patch([...node.value.conditions, c.value.blankLeaf()])
}
function addGroup() {
  patch([...node.value.conditions, { ...emptyGroup('and'), conditions: [c.value.blankLeaf()] }])
}
</script>
