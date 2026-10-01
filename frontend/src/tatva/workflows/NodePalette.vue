<!-- TATVA: node palette (left rail) — grouped by category, equal-height tiles (one-line description, full text on hover), folding to an icon strip like the CRM sidebar. -->
<template>
  <aside
    class="flex shrink-0 flex-col border-r border-outline-gray-2 bg-surface-gray-1 transition-all duration-300 ease-in-out"
    :class="railCollapsed ? 'w-12' : 'w-60'"
  >
    <div v-if="railCollapsed" class="flex flex-1 flex-col items-center gap-3 overflow-y-auto py-3">
      <div v-for="group in groups" :key="group.key" class="flex flex-col items-center gap-1.5">
        <span class="h-px w-6" :class="group.category.chip" />
        <Tooltip
          v-for="t in group.types"
          :key="t.type"
          :text="t.disabled ? __('This workflow already has a {0}.', [__(t.label)]) : __(t.label)"
          placement="right"
        >
          <div
            class="flex h-7 w-7 items-center justify-center rounded-md border bg-surface-white shadow-sm"
            :class="[
              group.category.border,
              t.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:shadow-md active:cursor-grabbing',
            ]"
            :draggable="!t.disabled"
            :aria-label="__(t.label)"
            @dragstart="onDragStart($event, t)"
          >
            <NodeChip :type="t.type" />
          </div>
        </Tooltip>
      </div>
    </div>

    <div v-else class="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
    <!-- The app's own collapsible Section (as on the lead side panel); the header keeps the category's colour and line. -->
    <Section
      v-for="group in groups"
      :key="group.key"
      :opened="!collapsed[group.key]"
      class="mt-1.5 flex flex-col gap-1.5"
    >
      <template #header="{ opened, toggle }">
        <button
          type="button"
          class="flex w-full items-center gap-1.5 px-1"
          :aria-expanded="opened"
          @click="toggle(); collapsed[group.key] = opened"
        >
          <FeatherIcon
            name="chevron-right"
            class="h-3 w-3 shrink-0 transition-transform"
            :class="[group.category.text, { 'rotate-90': opened }]"
          />
          <span class="text-[10px] font-semibold uppercase tracking-wider" :class="group.category.text">
            {{ __(group.category.label) }}
          </span>
          <span class="h-px flex-1" :class="group.category.chip" />
        </button>
      </template>

      <div
        v-for="t in group.types"
        :key="t.type"
        class="group overflow-hidden rounded-md border bg-surface-white shadow-sm transition-shadow"
        :class="[
          group.category.border,
          t.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:shadow-md active:cursor-grabbing',
        ]"
        :draggable="!t.disabled"
        :title="t.disabled ? __('This workflow already has a {0}.', [__(t.label)]) : __(t.description)"
        @dragstart="onDragStart($event, t)"
      >
        <div class="flex items-center gap-2 px-2 py-1" :class="group.category.bar">
          <NodeChip :type="t.type" />
          <span class="truncate text-xs font-semibold text-ink-gray-8">{{ __(t.label) }}</span>
        </div>
        <p
          class="truncate px-2 py-1.5 text-[10px] leading-[15px] text-ink-gray-6"
          :title="__(t.description)"
        >
          {{ __(t.description) }}
        </p>
      </div>
    </Section>

    <p class="px-1 text-[10px] leading-snug text-ink-gray-4">
      {{ __('Drag a node onto the canvas, then connect the handles.') }}
    </p>
    </div>

    <div class="flex border-t border-outline-gray-2 p-2" :class="railCollapsed ? 'justify-center' : 'justify-end'">
      <Button
        variant="ghost"
        :tooltip="railCollapsed ? __('Expand') : __('Collapse')"
        :aria-label="railCollapsed ? __('Expand') : __('Collapse')"
        @click="railCollapsed = !railCollapsed"
      >
        <template #icon>
          <CollapseSidebar
            class="h-4 w-4 text-ink-gray-7 duration-300 ease-in-out"
            :class="{ '[transform:rotateY(180deg)]': railCollapsed }"
          />
        </template>
      </Button>
    </div>
  </aside>
</template>
<script setup>
import { computed } from 'vue'
import { Button, FeatherIcon, Tooltip } from 'frappe-ui'
import CollapseSidebar from '@/components/Icons/CollapseSidebar.vue'
import { useStorage } from '@vueuse/core'
import Section from '@/components/Section.vue'
import { groupNodeTypes } from './nodeCatalog'
import NodeChip from './NodeChip.vue'
import { useNodeTypes } from '@/tatva/useNodeTypes'

const props = defineProps({
  // Node types already on the canvas, so a singleton the workflow owns is offered but not draggable.
  present: { type: Array, default: () => [] },
})

const { nodeTypes } = useNodeTypes()

// Which groups the author folded, per browser like the inspector width; every group starts open.
const collapsed = useStorage('tatva:workflow-palette-collapsed', {})
// The whole rail folded to icons, like the main sidebar's `isSidebarCollapsed`, but its own key so the two fold independently.
const railCollapsed = useStorage('tatva:workflow-palette-rail-collapsed', false)

// Grouped in CATEGORIES' own order, so the rail reads start → act → decide → wait → end.
const groups = computed(() => groupNodeTypes(nodeTypes.value, props.present))

// A Trigger is SHOWN even though only one may exist: hiding it left an author with no way to add the one node without which nothing ever fires, and no clue that it was missing. It is offered, and disabled once the workflow has one.
function onDragStart(event, t) {
  if (t.disabled) return event.preventDefault()
  event.dataTransfer.setData('application/workflow-node', t.type)
  event.dataTransfer.effectAllowed = 'move'
}
</script>
