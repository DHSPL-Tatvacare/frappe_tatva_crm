<!-- TATVA: the record header's actions from tatva_connect: one action is a button, more make it a split button whose arrow lists the rest; nothing while the record offers none. -->
<template>
  <div v-if="offered.length" class="flex shrink-0 items-center">
    <Button
      v-if="compact"
      :aria-label="offered[0].label"
      :tooltip="offered[0].label"
      :class="offered.length > 1 ? 'rounded-r-none' : ''"
      @click="start(offered[0])"
    >
      <template #icon>
        <img :src="offered[0].icon" alt="" class="size-4 rounded-sm" />
      </template>
    </Button>
    <Button
      v-else
      :label="offered[0].label"
      :class="offered.length > 1 ? 'rounded-r-none' : ''"
      @click="start(offered[0])"
    >
      <template #prefix>
        <img :src="offered[0].icon" alt="" class="size-4 rounded-sm" />
      </template>
    </Button>
    <Dropdown v-if="offered.length > 1" :options="rest">
      <Button class="rounded-l-none border-l border-outline-gray-2" icon="chevron-down" />
    </Dropdown>
    <RecordActionDialog
      v-if="chosen"
      v-model:open="dialogOpen"
      :action="chosen"
      :doctype="doctype"
      :name="name"
    />
  </div>
</template>

<script setup>
import { computed, h, ref, watch } from 'vue'
import { Button, createResource, Dropdown } from 'frappe-ui'
import RecordActionDialog from '@/tatva/record_actions/RecordActionDialog.vue'
import { FORM_VERSION, RECORD_ACTIONS_API } from '@/tatva/record_actions/recordActions'

const props = defineProps({
  doctype: { type: String, required: true },
  name: { type: String, required: true },
  // Shows the first action as its icon alone, for a phone header.
  compact: { type: Boolean, default: false },
})

const actions = createResource({
  url: `${RECORD_ACTIONS_API}.actions`,
  method: 'GET',
  makeParams: () => ({ doctype: props.doctype, name: props.name, form_version: FORM_VERSION }),
  onError() {}, // an older backend or a refusal leaves the header as it was
})
// One read per record; moving to another lead reads that one's.
watch(() => props.name, (name) => name && actions.fetch(), { immediate: true })

const offered = computed(() => actions.data || [])
const rest = computed(() =>
  offered.value.slice(1).map((action) => ({
    label: action.label,
    icon: () => h('img', { src: action.icon, alt: '', class: 'size-4 rounded-sm' }),
    onClick: () => start(action),
  })),
)

const chosen = ref(null)
const dialogOpen = ref(false)
function start(action) {
  chosen.value = action
  dialogOpen.value = true
}
</script>
