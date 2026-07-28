<template>
  <!-- TATVA: notes + tasks open our unified native modals; calls keep the generic doctype modal. -->
  <TatvaNoteModal
    v-if="noteModalOpen"
    v-model="noteModalOpen"
    :note="noteModalNote"
    :defaults="noteModalDefaults"
    @saved="onNoteSaved"
  />
  <TatvaTaskModal
    v-if="taskModalOpen"
    v-model="taskModalOpen"
    :task="taskModalTask"
    :lead="doc?.name"
    :reference-doctype="doctype"
    :mode="taskModalMode"
    @saved="onTaskSaved"
  />
</template>
<script setup>
import TatvaNoteModal from '@/tatva/NoteModal.vue'
import TatvaTaskModal from '@/tatva/TaskModal.vue'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { call } from 'frappe-ui'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps({
  doctype: { type: String, default: '' },
  doc: { type: Object, default: () => ({}) },
  // TATVA: the ACTIVE tab's own refresh. A paged tab must reload its page — reloading the whole-lead
  // resource left a just-saved note invisible and refetched a history the tab no longer reads.
  refresh: { type: Function, default: null },
})

const activities = defineModel({ type: Object })
const refresh = () =>
  props.refresh ? props.refresh() : activities.value?.reload()

const { showModal } = useDoctypeModal()
const { updateOnboardingStep } = useOnboarding('frappecrm')
const { capture } = useTelemetry()

// Tasks — TATVA: our unified native TaskModal (create/edit/view/complete), not the generic modal.
const taskModalOpen = ref(false)
const taskModalTask = ref(null)
const taskModalMode = ref('create')

function showTask(task) {
  taskModalTask.value = task || null
  taskModalMode.value = task ? 'view' : 'create'
  taskModalOpen.value = true
}

function onTaskSaved() {
  refresh()
  if (!taskModalTask.value) {
    updateOnboardingStep('create_first_task')
    capture('task_created')
  } else {
    capture('task_updated')
  }
  redirect('tasks')
}

async function deleteTask(name) {
  await call('frappe.client.delete', {
    doctype: 'CRM Task',
    name,
  })
  refresh()
}

function updateTaskStatus(status, task) {
  call('frappe.client.set_value', {
    doctype: 'CRM Task',
    name: task.name,
    fieldname: 'status',
    value: status,
  }).then(() => {
    refresh()
  })
}

// Notes — TATVA: our unified NoteModal (with native attachments), not the generic doctype modal.
const noteModalOpen = ref(false)
const noteModalNote = ref(null)
const noteModalDefaults = ref({})

function showNote(note) {
  noteModalNote.value = note || null
  noteModalDefaults.value = {
    reference_doctype: props.doctype,
    reference_docname: props.doc?.name,
  }
  noteModalOpen.value = true
}

// Same side-effects as the generic modal's afterInsert/afterUpdate, driven by NoteModal's saved event.
function onNoteSaved({ isInsert } = {}) {
  refresh()
  if (isInsert) {
    updateOnboardingStep('create_first_note')
    capture('note_created')
  } else {
    capture('note_updated')
  }
  redirect('notes')
}

function afterDoctype(d, isInsert = false) {
  refresh()

  let name =
    d.doctype == 'FCRM Note'
      ? 'note'
      : d.doctype == 'CRM Task'
        ? 'task'
        : 'call_log'

  let redirectHash = name + 's'
  if (d.doctype == 'CRM Call Log') {
    redirectHash = 'calls'
  }

  if (isInsert) {
    updateOnboardingStep('create_first_' + name)
    capture(name + '_created')
  } else {
    capture(name + '_updated')
  }

  redirect(redirectHash)
}

// Call Logs
function createCallLog() {
  showModal({
    doctype: 'CRM Call Log',
    title: 'Call Log',
    defaults: {
      reference_doctype: props.doctype,
      reference_docname: props.doc?.name,
      reference_doc: { ...props.doc },
    },
    callbacks: {
      afterInsert: (d) => afterDoctype(d, true),
      afterUpdate: afterDoctype,
    },
  })
}

// common
const route = useRoute()
const router = useRouter()

function redirect(tabName) {
  if (route.name == 'Lead' || route.name == 'Deal') {
    let hash = '#' + tabName
    if (route.hash != hash) {
      router.push({ ...route, hash })
    }
  }
}

defineExpose({
  showTask,
  deleteTask,
  updateTaskStatus,
  showNote,
  createCallLog,
})
</script>
