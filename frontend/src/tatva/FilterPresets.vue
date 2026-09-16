<!-- TATVA: FilterPresets — a person's named filter-and-sort sets on one surface (doctype + optional name), stored and replayed verbatim in the surface's own shapes; server is tatva_connect.presets. -->
<template>
  <Dropdown :options="menu" placement="left">
    <!-- A static label like Filter/Sort, with the applied preset ticked inside; icon-only via `icon`/`iconLeft` so the label stays the aria-label. -->
    <Button
      :label="__('Presets')"
      :icon="hideLabel ? LucideFunnelPlus : undefined"
      :iconLeft="hideLabel ? undefined : LucideFunnelPlus"
      :tooltip="__('Saved filters')"
    />
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
import {
  Button,
  Dropdown,
  FeatherIcon,
  FormControl,
  call,
  createResource,
  toast,
} from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import LucideFunnelPlus from '~icons/lucide/funnel-plus' // TATVA: a preset IS a saved filter
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

const showSave = ref(false)
const draftLabel = ref('')
const saving = ref(false)

const parsed = (p) => ({
  filters: JSON.parse(p.filters || '{}'),
  sort: p.sort ? JSON.parse(p.sort) : '',
})

// Derived, never remembered: "applied" means what is on screen matches this preset.
const applied = computed(() =>
  presets.value.find((p) => {
    const was = parsed(p)
    return (
      isEqual(was.filters, props.filters || {}) && was.sort === (props.sort || '')
    )
  }),
)

// Read through `.data` (C.4); an error leaves it undefined and the control offers nothing.
const savedPresets = createResource({
  url: 'tatva_connect.presets.list_presets',
  makeParams: () => ({
    reference_doctype: props.referenceDoctype,
    reference_name: props.referenceName || null,
  }),
})
const presets = computed(() => savedPresets.data || [])
// ONE fetch path (C.3): once on mount, again only if the surface it names changes.
watch(() => [props.referenceDoctype, props.referenceName], () => savedPresets.reload(), { immediate: true })

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
    await savedPresets.reload() // `applied` follows on its own: the saved row now matches what is on screen
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
    await savedPresets.reload()
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
          p.name === applied.value?.name
            ? h(FeatherIcon, { name: 'check', class: 'h-4 w-4' })
            : h(LucideFunnelPlus, { class: 'h-4 w-4' }),
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
