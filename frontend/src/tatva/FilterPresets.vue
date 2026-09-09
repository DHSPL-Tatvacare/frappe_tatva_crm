<!--
  TATVA: FilterPresets — a person's named filter-and-sort combinations on ONE listing surface.

  GENERIC, like ListBulkActions: it is handed a surface as `(referenceDoctype, referenceName)` — frappe's
  own Dynamic Link pair — and knows nothing about Smart Views. `referenceName` blank means the whole list
  of that doctype, which is what a native list view is, so this drops into ViewControls with two props.

  It never INTERPRETS a filter. `filters` and `sort` are handed in and handed back in whatever shape the
  surface already uses (the native Filter control's dict, the SortBy control's order_by string), so a
  surface can change its filter grammar without this component learning a second one.

  Server: tatva_connect.presets — personal rows, gated by whether the caller may open the surface.
-->
<template>
  <Dropdown :options="menu" placement="left">
    <Button :tooltip="__('Saved filters')" :label="hideLabel ? null : activeLabel">
      <template #prefix><FeatherIcon name="bookmark" class="h-4 w-4" /></template>
    </Button>
  </Dropdown>

  <ResponsiveDialog
    v-model="showSave"
    :options="{ title: __('Save these filters') }"
  >
    <template #body-content>
      <FormControl
        v-model="draftLabel"
        type="text"
        :label="__('Name')"
        :placeholder="__('My open leads this week')"
        @keydown.enter="save"
      />
      <p class="mt-3 text-p-sm text-ink-gray-5">
        {{ __('Only you can see your saved filters. Saving over a name replaces it.') }}
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <Button :label="__('Cancel')" @click="showSave = false" />
        <Button
          variant="solid"
          :label="__('Save')"
          :loading="saving"
          :disabled="!draftLabel.trim()"
          @click="save"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { Button, Dropdown, FeatherIcon, FormControl, call, toast } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { computed, h, ref, watch } from 'vue'

const props = defineProps({
  // The surface, as frappe points at anything: a doctype and (optionally) one document of it.
  referenceDoctype: { type: String, required: true },
  referenceName: { type: String, default: '' },
  // What is on screen right now, in the surface's OWN shapes — stored verbatim, never parsed here.
  filters: { type: Object, default: () => ({}) },
  sort: { type: String, default: '' },
  hideLabel: { type: Boolean, default: false },
})
const emit = defineEmits(['apply'])

const presets = ref([])
const activeName = ref('')
const showSave = ref(false)
const draftLabel = ref('')
const saving = ref(false)

const activeLabel = computed(
  () => presets.value.find((p) => p.name === activeName.value)?.label || __('Saved'),
)

async function load() {
  if (!props.referenceDoctype) return
  try {
    presets.value = await call('tatva_connect.presets.list_presets', {
      reference_doctype: props.referenceDoctype,
      reference_name: props.referenceName || null,
    })
  } catch {
    presets.value = [] // an optional affordance must never destabilise the list it sits on
  }
}
// The surface can change under a live component (a Smart View tab switch), so the list follows it.
watch(() => [props.referenceDoctype, props.referenceName], load, { immediate: true })

function apply(preset) {
  activeName.value = preset.name
  emit('apply', {
    filters: JSON.parse(preset.filters || '{}'),
    sort: preset.sort ? JSON.parse(preset.sort) : '',
  })
}

async function save() {
  const label = draftLabel.value.trim()
  if (!label) return
  saving.value = true
  try {
    const saved = await call('tatva_connect.presets.save_preset', {
      reference_doctype: props.referenceDoctype,
      reference_name: props.referenceName || null,
      label,
      filters: JSON.stringify(props.filters || {}),
      sort: JSON.stringify(props.sort || ''),
    })
    showSave.value = false
    draftLabel.value = ''
    await load()
    activeName.value = saved.name
    toast.success(__('Saved'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not save these filters'))
  } finally {
    saving.value = false
  }
}

async function remove(name) {
  try {
    await call('tatva_connect.presets.delete_preset', { name })
    if (activeName.value === name) activeName.value = ''
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not delete this preset'))
  }
}

const menu = computed(() => {
  const groups = []
  if (presets.value.length) {
    groups.push({
      group: __('Saved filters'),
      items: presets.value.map((p) => ({
        label: p.label,
        icon: () => h(FeatherIcon, { name: p.name === activeName.value ? 'check' : 'bookmark', class: 'h-4 w-4' }),
        onClick: () => apply(p),
      })),
    })
  }
  const actions = [
    {
      label: __('Save current filters…'),
      icon: () => h(FeatherIcon, { name: 'plus', class: 'h-4 w-4' }),
      onClick: () => {
        draftLabel.value = activeLabel.value === __('Saved') ? '' : activeLabel.value
        showSave.value = true
      },
    },
  ]
  if (activeName.value) {
    actions.push({
      label: __('Delete this preset'),
      icon: () => h(FeatherIcon, { name: 'trash-2', class: 'h-4 w-4' }),
      onClick: () => remove(activeName.value),
    })
  }
  groups.push({ group: __('Options'), hideLabel: true, items: actions })
  return groups
})
</script>
