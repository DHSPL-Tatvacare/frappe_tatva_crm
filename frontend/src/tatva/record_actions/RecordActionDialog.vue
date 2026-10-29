<!-- TATVA: one record action's dialog: the server's fields for the choices made so far, what earlier runs already made, a refresh of what the server remembers, and the submit; a bottom sheet on a phone through ResponsiveDialog. Helpdesk has the same piece. -->
<template>
  <ResponsiveDialog v-model="open" :options="{ size: '3xl' }">
    <template #body-title>
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <img :src="action.icon" alt="" class="size-5 shrink-0" />
        <h3 class="truncate text-2xl font-semibold leading-6 text-ink-gray-9">
          {{ form.data?.title || action.label }}
        </h3>
        <Tooltip :text="__('Refresh')">
          <Button
            variant="ghost"
            icon="refresh-cw"
            class="ml-auto shrink-0"
            :aria-label="__('Refresh')"
            :loading="refreshing"
            :disabled="form.loading"
            @click="refresh"
          />
        </Tooltip>
      </div>
    </template>
    <template #body-content>
      <div v-if="!form.data" class="flex items-center justify-center py-10">
        <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
      </div>
      <div v-else class="flex flex-col gap-4">
        <Alert v-if="form.data.existing.length" theme="blue" :title="__('Already created from here')">
          <template #description>
            <span class="flex flex-wrap gap-x-3 gap-y-1">
              <a
                v-for="link in form.data.existing"
                :key="link.key"
                :href="link.url"
                target="_blank"
                rel="noopener"
                class="font-medium text-ink-gray-8 underline-offset-2 hover:underline"
              >
                {{ link.key }}<template v-if="link.status"> · {{ link.status }}</template>
              </a>
            </span>
          </template>
        </Alert>
        <Alert v-if="form.data.warning" theme="yellow" :title="form.data.warning" />
        <div class="grid grid-cols-2 gap-4">
          <div
            v-for="field in form.data.fields"
            :key="field.fieldname"
            :class="field.half ? 'col-span-2 sm:col-span-1' : 'col-span-2'"
          >
            <RecordActionSearch
              v-if="field.fieldtype === 'Search'"
              :key="searchKey"
              v-model="values[field.fieldname]"
              :field="field"
              :action="action.key"
              :doctype="doctype"
              :name="name"
              :values="builtFor"
            />
            <RecordActionTags v-else-if="field.fieldtype === 'Tags'" v-model="values[field.fieldname]" :field="field" />
            <RecordActionChoice
              v-else-if="field.fieldtype === 'Select'"
              v-model="values[field.fieldname]"
              :field="field"
              :options="field.options"
            />
            <div v-else-if="field.fieldtype === 'Date'" class="space-y-1.5">
              <label class="block text-xs text-ink-gray-5">
                {{ field.label }}<span v-if="field.reqd" class="text-ink-red-3"> *</span>
              </label>
              <DatePicker
                :value="values[field.fieldname]"
                :placeholder="__('Select date')"
                @change="(v) => (values[field.fieldname] = v || null)"
              />
            </div>
            <FormControl
              v-else
              v-model="values[field.fieldname]"
              :type="CONTROL[field.fieldtype]"
              :label="field.label"
              :required="!!field.reqd"
              :placeholder="field.placeholder"
            />
          </div>
        </div>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end">
        <Button
          variant="solid"
          class="w-full sm:w-auto"
          :label="form.data?.submit || action.label"
          :loading="saving"
          :disabled="!ready"
          @click="submit"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Alert, Button, call, createResource, DatePicker, FormControl, LoadingIndicator, toast, Tooltip } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import RecordActionChoice from '@/tatva/record_actions/RecordActionChoice.vue'
import RecordActionSearch from '@/tatva/record_actions/RecordActionSearch.vue'
import RecordActionTags from '@/tatva/record_actions/RecordActionTags.vue'
import { CONTROL, emptyOf, RECORD_ACTIONS_API, recordActionsRan } from '@/tatva/record_actions/recordActions'

const props = defineProps({
  action: { type: Object, required: true },
  doctype: { type: String, required: true },
  name: { type: String, required: true },
})
const open = defineModel('open', { type: Boolean, default: false })

const values = reactive({})
const saving = ref(false)
const refreshing = ref(false)

const errorOf = (e) => e?.messages?.[0] || e?.message || __('Something went wrong')

const form = createResource({
  url: `${RECORD_ACTIONS_API}.form`,
  method: 'GET',
  makeParams: () => ({
    action: props.action.key,
    doctype: props.doctype,
    name: props.name,
    values: JSON.stringify(choices.value),
  }),
  onError: (e) => {
    toast.error(errorOf(e))
    open.value = false
  },
})

const fields = computed(() => form.data?.fields || [])
const reloading = computed(() => fields.value.filter((f) => f.reloads))
// The choices that shape the form, such as project and issue type: as the person has them, and as the server built the form for.
const choicesOf = (read) => Object.fromEntries(reloading.value.map((f) => [f.fieldname, read(f) ?? null]))
const choices = computed(() => choicesOf((f) => values[f.fieldname]))
const builtFor = computed(() => choicesOf((f) => f.default))
// A search follows the choices the form was built for, so a rebuilt form starts its searches afresh.
const searchKey = computed(() => JSON.stringify(builtFor.value))

// Each field takes the server's default unless the person already set a value it still offers; gone fields are dropped.
function applyDefaults(data) {
  const names = new Set(data.fields.map((f) => f.fieldname))
  for (const key of Object.keys(values)) if (!names.has(key)) delete values[key]
  for (const field of data.fields) {
    const offered = field.fieldtype !== 'Select' || field.options?.some((o) => o.value === values[field.fieldname])
    if (values[field.fieldname] === undefined || !offered)
      values[field.fieldname] = Array.isArray(field.default) ? [...field.default] : field.default ?? emptyOf(field)
  }
}
// Choices the form was not built for ask for it again; a searched value belonged to the old choices.
// Checked on every change and again when a load lands, so a choice made while loading is not lost.
function rebuildIfChoicesChanged() {
  if (!form.data || form.loading || JSON.stringify(choices.value) === searchKey.value) return
  for (const f of fields.value) if (f.fieldtype === 'Search') values[f.fieldname] = null
  form.reload()
}
watch(
  () => form.data,
  (data) => {
    if (!data) return
    applyDefaults(data)
    rebuildIfChoicesChanged()
  },
  { immediate: true }
)
watch(() => JSON.stringify(choices.value), rebuildIfChoicesChanged)

// Opening reads the form while the last one paints at once; closing puts every field back to its default.
function resetValues() {
  for (const key of Object.keys(values)) delete values[key]
  if (form.data) applyDefaults(form.data)
}
watch(open, (isOpen) => (isOpen ? (form.fetched ? form.reload() : form.fetch()) : resetValues()), { immediate: true })
// Another record's dialog starts from nothing.
watch(() => props.name, () => form.reset())

const ready = computed(
  () =>
    !form.loading &&
    fields.value.every((f) => !f.reqd || (Array.isArray(values[f.fieldname]) ? values[f.fieldname].length : String(values[f.fieldname] ?? '').trim())),
)

// Forget what the server remembers from the other system, then read the form afresh, one after the other.
function refresh() {
  refreshing.value = true
  call(`${RECORD_ACTIONS_API}.refresh`, { action: props.action.key, doctype: props.doctype, name: props.name })
    .then(() => form.reload())
    .catch((e) => toast.error(errorOf(e)))
    .finally(() => (refreshing.value = false))
}

function submit() {
  saving.value = true
  call(`${RECORD_ACTIONS_API}.run`, {
    action: props.action.key,
    doctype: props.doctype,
    name: props.name,
    values: JSON.stringify(values),
  })
    .then((made) => {
      toast.success(__('Created {0}', [made.key]))
      recordActionsRan.value++
      open.value = false
    })
    .catch((e) => toast.error(errorOf(e)))
    .finally(() => (saving.value = false))
}
</script>
