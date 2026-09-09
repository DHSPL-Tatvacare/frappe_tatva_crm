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
    <!-- A STATIC label, like Filter and Sort beside it. Wearing the preset's name made this read as a
         second view name in a toolbar that already sits under one, and it kept saying it after the
         filters were cleared. Which preset is applied is shown by the tick inside, where it is true. -->
    <Button :tooltip="__('Saved filters')" :label="hideLabel ? null : __('Presets')">
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
import { isEqual } from 'lodash'
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
const showSave = ref(false)
const draftLabel = ref('')
const saving = ref(false)

const parsed = (p) => ({
  filters: JSON.parse(p.filters || '{}'),
  sort: p.sort ? JSON.parse(p.sort) : '',
})

// DERIVED, never remembered: "applied" means what is on screen IS this preset. Held as a ref it went on
// naming a preset after the filters had been cleared out from under it — the control claiming a state
// the list was not in. Nothing to reset, so nothing to forget to reset.
const applied = computed(() =>
  presets.value.find((p) => {
    const was = parsed(p)
    return (
      isEqual(was.filters, props.filters || {}) && was.sort === (props.sort || '')
    )
  }),
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

async function save() {
  const label = draftLabel.value.trim()
  if (!label) return
  saving.value = true
  try {
    await call('tatva_connect.presets.save_preset', {
      reference_doctype: props.referenceDoctype,
      reference_name: props.referenceName || null,
      label,
      filters: JSON.stringify(props.filters || {}),
      sort: JSON.stringify(props.sort || ''),
    })
    showSave.value = false
    draftLabel.value = ''
    await load() // `applied` follows on its own: the saved row now matches what is on screen
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
        icon: () =>
          h(FeatherIcon, {
            name: p.name === applied.value?.name ? 'check' : 'bookmark',
            class: 'h-4 w-4',
          }),
        onClick: () => emit('apply', parsed(p)),
      })),
    })
  }
  const actions = [
    {
      label: __('Save current filters…'),
      icon: () => h(FeatherIcon, { name: 'plus', class: 'h-4 w-4' }),
      onClick: () => {
        draftLabel.value = applied.value?.label || ''
        showSave.value = true
      },
    },
  ]
  if (applied.value) {
    actions.push({
      label: __('Delete "{0}"', [applied.value.label]),
      icon: () => h(FeatherIcon, { name: 'trash-2', class: 'h-4 w-4' }),
      onClick: () => remove(applied.value.name),
    })
  }
  groups.push({ group: __('Options'), hideLabel: true, items: actions })
  return groups
})
</script>
