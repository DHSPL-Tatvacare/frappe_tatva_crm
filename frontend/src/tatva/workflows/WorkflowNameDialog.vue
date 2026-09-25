<!-- TATVA: Workflows create + duplicate — one dialog, as Task Forms' FormDialog; both are born Drafts, so nothing runs until published and activated. -->
<template>
  <Dialog
    v-model="show"
    :options="{ title: source ? __('Duplicate workflow') : __('New Workflow') }"
  >
    <template #body-content>
      <div class="flex flex-col gap-4">
        <FormControl
          v-model="workflowName"
          :label="__('Workflow Name')"
          :placeholder="__('e.g. Physical Visit Follow-up')"
          @keyup.enter="submit"
        />
        <p class="text-sm text-ink-gray-5">
          {{
            source
              ? __('The copy starts as a Draft with the same trigger and steps, and no runs or versions.')
              : __('Starts on a blank canvas. Drop in a Trigger and build the flow from there.')
          }}
        </p>
        <ErrorMessage :message="error" />
      </div>
    </template>
    <template #actions>
      <Button
        variant="solid"
        class="w-full"
        :label="source ? __('Duplicate') : __('Create')"
        :loading="saving"
        @click="submit"
      />
    </template>
  </Dialog>
</template>
<script setup>
import { Button, Dialog, ErrorMessage, FormControl, call } from 'frappe-ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  // The loaded workflow to copy; absent, a blank Draft is created.
  source: { type: Object, default: null },
})
const show = defineModel({ type: Boolean, default: false })
const router = useRouter()

const workflowName = ref(props.source ? `${props.source.workflow_name} (${__('copy')})` : '')
const saving = ref(false)
const error = ref('')

async function submit() {
  const name = workflowName.value.trim()
  if (!name || saving.value) return
  saving.value = true
  error.value = ''
  try {
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
