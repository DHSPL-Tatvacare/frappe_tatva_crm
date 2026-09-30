<!-- TATVA: Workflows create, duplicate and rename — one dialog, as Task Forms' FormDialog; create and duplicate are born Drafts, rename changes only the name. -->
<template>
  <ResponsiveDialog
    v-model="show"
    :options="{ title: __(copy.title) }"
  >
    <template #body-content>
      <div class="flex flex-col gap-4">
        <FormControl
          v-model="workflowName"
          :label="__('Workflow Name')"
          :placeholder="__('e.g. Physical Visit Follow-up')"
          @keyup.enter="submit"
        />
        <p class="text-sm text-ink-gray-5">{{ __(copy.hint) }}</p>
        <ErrorMessage :message="error" />
      </div>
    </template>
    <template #actions>
      <Button
        variant="solid"
        class="w-full sm:w-auto"
        :label="__(copy.action)"
        :loading="saving"
        @click="submit"
      />
    </template>
  </ResponsiveDialog>
</template>
<script setup>
import { Button, ErrorMessage, FormControl, call } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  // The loaded workflow to copy; absent, a blank Draft is created.
  source: { type: Object, default: null },
  // The loaded workflow to rename, which keeps its id, versions and runs.
  renaming: { type: Object, default: null },
})
const emit = defineEmits(['renamed'])
const show = defineModel({ type: Boolean, default: false })

const COPY = {
  create: { title: 'New Workflow', action: 'Create', hint: 'Starts on a blank canvas. Drop in a Trigger and build the flow from there.' },
  duplicate: { title: 'Duplicate workflow', action: 'Duplicate', hint: 'The copy starts as a Draft with the same trigger and steps, and no runs or versions.' },
  rename: { title: 'Rename workflow', action: 'Rename', hint: 'Only the name changes. Its steps, versions and past runs stay as they are.' },
}
const copy = computed(() => COPY[props.renaming ? 'rename' : props.source ? 'duplicate' : 'create'])
const router = useRouter()

const workflowName = ref(
  props.renaming ? props.renaming.workflow_name : props.source ? `${props.source.workflow_name} (${__('copy')})` : '',
)
const saving = ref(false)
const error = ref('')

async function submit() {
  const name = workflowName.value.trim()
  if (!name || saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (props.renaming) {
      await call('frappe.client.set_value', { doctype: 'CRM Workflow', name: props.renaming.name, fieldname: 'workflow_name', value: name })
      show.value = false
      return emit('renamed')
    }
    const doc = props.source
      ? await call('tatva_connect.workflows.api.duplicate', { name: props.source.name, workflow_name: name })
      : await call('tatva_connect.workflows.api.create_workflow', { workflow_name: name })
    show.value = false
    router.push({ name: 'Workflow', params: { workflowId: doc.name } })
  } catch (e) {
    error.value = (e?.messages?.length ? e.messages : [e?.message || __('Could not save the workflow')]).join(' ')
  } finally {
    saving.value = false
  }
}
</script>
