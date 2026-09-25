<!-- TATVA: Task Forms create + duplicate — one dialog; a new form starts Disabled so reps never meet a half-built one. -->
<template>
  <Dialog
    v-model="show"
    :options="{ title: source ? __('Duplicate form') : __('New form') }"
  >
    <template #body-content>
      <div class="flex flex-col gap-4">
        <FormControl v-model="typeName" :label="labelOf('type_name')" @keyup.enter="submit" />
        <!-- An entitled author picks one of their own grains through the one grain control; a System Manager picks each axis. -->
        <GrainSelect v-if="!grainAll" v-model="grainKey" />
        <template v-else>
          <FormControl
            v-for="axis in AXES"
            :key="axis"
            v-model="axes[axis]"
            type="select"
            :label="labelOf(axis)"
            :placeholder="__('Any')"
            :options="(masters[axis].data || []).map((m) => ({ label: m.name, value: m.name }))"
          />
          <!-- A select cannot offer a blank choice, so going back to Any is its own control. -->
          <Button
            v-if="AXES.some((a) => axes[a])"
            variant="ghost"
            :label="__('Reset grain to Any')"
            @click="AXES.forEach((a) => (axes[a] = ''))"
          />
        </template>
        <p class="text-sm text-ink-gray-5">
          {{ __('It starts Disabled. Enable it from the form once it is ready for reps.') }}
        </p>
        <ErrorMessage :message="error" />
      </div>
    </template>
    <template #actions>
      <Button
        variant="solid"
        class="w-full"
        :label="source ? __('Duplicate') : __('Create')"
        :loading="creating"
        @click="submit"
      />
    </template>
  </Dialog>
</template>
<script setup>
import { useEntitledGrains, axesFromKey, keyFromAxes } from '@/tatva/useEntitledGrains'
import GrainSelect from '@/tatva/GrainSelect.vue'
import { getMeta } from '@/stores/meta'
import { Button, Dialog, ErrorMessage, FormControl, call, createResource } from 'frappe-ui'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  // The loaded form to copy; absent, a blank form is created.
  source: { type: Object, default: null },
})
const show = defineModel({ type: Boolean, default: false })
const router = useRouter()

const AXES = ['vertical', 'group', 'program']
const { getFields, meta } = getMeta('CRM Task Type')
const fieldOf = (fieldname) => getFields()?.find((f) => f.fieldname === fieldname)
const labelOf = (fieldname) => __(fieldOf(fieldname)?.label || fieldname)

const typeName = ref(props.source ? `${props.source.type_name} (${__('copy')})` : '')
const { resource: grains, grainAll } = useEntitledGrains()
const grainKey = ref(props.source ? keyFromAxes(props.source) : '')
const axes = reactive(Object.fromEntries(AXES.map((a) => [a, props.source?.[a] || ''])))

// Only an author entitled to every grain picks the three axes, so only they read the three masters — each axis's own Link target.
const masters = Object.fromEntries(
  AXES.map((a) => [
    a,
    createResource({
      url: 'frappe.client.get_list',
      makeParams: () => ({ doctype: fieldOf(a)?.options, fields: ['name'], order_by: 'name asc', limit_page_length: 0 }),
    }),
  ]),
)
onMounted(async () => {
  await Promise.all([grains.data ? null : grains.promise, meta.loading ? meta.promise : null])
  if (grainAll.value) AXES.forEach((a) => masters[a].fetch())
})

// A copy is the whole declaration minus what makes it a stored record; a child row sent with its old `name` would be lost.
const RECORD = ['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx']
const CHILD = [...RECORD, 'parent', 'parenttype', 'parentfield']
// `_`-keys are the record's own bookkeeping (comments, assignments, likes, tags) and never travel with a copy.
const strip = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k) && !k.startsWith('_')))
// Every child table the doctype declares, read off its meta, so a table added later travels with the copy too.
function copyOf(src) {
  const tables = (getFields({ restrictNoValueFields: false }) || []).filter((f) => ['Table', 'Table MultiSelect'].includes(f.fieldtype))
  return {
    ...strip(src, RECORD),
    ...Object.fromEntries(tables.map((f) => [f.fieldname, (src[f.fieldname] || []).map((r) => strip(r, CHILD))])),
  }
}

const creating = ref(false)
const error = ref('')
async function submit() {
  if (!typeName.value.trim()) return
  // An empty pick is not "every grain" for a scoped author: they choose one of their own.
  if (!grainAll.value && !grainKey.value) {
    error.value = __('Pick a grain.')
    return
  }
  const grain = grainAll.value ? axes : axesFromKey(grainKey.value)
  const doc = {
    ...(props.source ? copyOf(props.source) : { doctype: 'CRM Task Type' }),
    type_name: typeName.value.trim(),
    ...grain,
    enabled: 0,
  }
  creating.value = true
  error.value = ''
  try {
    const saved = await call('frappe.client.insert', { doc })
    show.value = false
    router.push({ name: 'TaskForm', params: { formName: saved.name } })
  } catch (e) {
    error.value = (e?.messages?.length ? e.messages : [e?.message || __('Could not create the form')]).join(' ')
  } finally {
    creating.value = false
  }
}
</script>
