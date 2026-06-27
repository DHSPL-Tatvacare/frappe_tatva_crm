<!--
  NoteModal — the ONE note create/edit modal for the whole app (lead/deal Notes tab + the Notes main
  page). Native frappe-ui Dialog: title + content (TextEditor) + an attachments section that reuses the
  native <FilesUploader> to attach files to the FCRM Note. The File doc_events own the Azure lifecycle
  (privacy: private unless the doctype is operator-listed public — FCRM Note is not; offload to Azure;
  file_url is the Azure proxy), so this modal does NOT touch storage — it only links + lists + removes.

  Attachments need the note to exist (a File's attached_to_name), so on a brand-new note "Create" saves
  first and the modal stays open in edit mode with the attach button enabled. Lives in tatva/ (additive).
-->
<template>
  <Dialog v-model="show" :options="{ size: 'xl' }">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
            {{ name ? __('Edit Note') : __('Create Note') }}
          </h3>
          <Button variant="ghost" class="w-7" icon="x" @click="close" />
        </div>

        <FormControl
          v-model="title"
          :label="__('Title')"
          :placeholder="__('Note title')"
          class="mb-3"
        />

        <div class="mb-1 text-xs text-ink-gray-5">{{ __('Content') }}</div>
        <TextEditor
          :content="content"
          :editable="true"
          :editor-class="[
            'prose-sm max-w-none min-h-[8rem] rounded border border-outline-gray-2 px-3 py-2 focus:outline-none',
          ]"
          @change="content = $event"
        />

        <!-- Attachments (links to the FCRM Note; Azure privacy/serving handled by the File hooks) -->
        <div class="mt-5">
          <div class="mb-2 flex items-center justify-between">
            <div class="text-xs font-medium text-ink-gray-5">
              {{ __('Attachments') }}
            </div>
            <Button
              variant="subtle"
              :label="__('Attach')"
              iconLeft="paperclip"
              :disabled="!name"
              :tooltip="name ? '' : __('Save the note to attach files')"
              @click="uploaderOpen = true"
            />
          </div>
          <div v-if="attachments.data?.length" class="flex flex-col gap-1.5">
            <div
              v-for="f in attachments.data"
              :key="f.name"
              class="flex items-center gap-2 rounded border border-outline-gray-1 px-2.5 py-1.5"
            >
              <FeatherIcon name="paperclip" class="size-3.5 shrink-0 text-ink-gray-5" />
              <a
                :href="f.file_url"
                target="_blank"
                class="truncate text-sm text-ink-gray-8 hover:underline"
              >
                {{ f.file_name }}
              </a>
              <FeatherIcon
                v-if="f.is_private"
                name="lock"
                class="size-3 shrink-0 text-ink-gray-4"
              />
              <button
                class="ml-auto shrink-0"
                :title="__('Remove')"
                @click="removeAttachment(f)"
              >
                <FeatherIcon
                  name="x"
                  class="size-3.5 text-ink-gray-5 hover:text-ink-gray-8"
                />
              </button>
            </div>
          </div>
          <div v-else-if="name" class="text-xs text-ink-gray-4">
            {{ __('No attachments yet.') }}
          </div>
        </div>

        <ErrorMessage v-if="error" class="mt-3" :message="error" />
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            variant="solid"
            :label="name ? __('Save') : __('Create')"
            :loading="saving"
            @click="save"
          />
          <Button :label="__('Close')" @click="close" />
        </div>
      </div>
    </template>
  </Dialog>

  <FilesUploader
    v-if="name"
    v-model="uploaderOpen"
    doctype="FCRM Note"
    :docname="name"
    @after="onUploaded"
  />
</template>
<script setup>
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import {
  Dialog,
  FormControl,
  Button,
  FeatherIcon,
  TextEditor,
  ErrorMessage,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { ref, watch } from 'vue'

const props = defineProps({
  note: { type: Object, default: null }, // existing note (edit) or null (create)
  defaults: { type: Object, default: () => ({}) }, // {reference_doctype, reference_docname}
})

const show = defineModel({ type: Boolean })
const emit = defineEmits(['saved'])

const name = ref(null)
const title = ref('')
const content = ref('')
const saving = ref(false)
const error = ref(null)
const uploaderOpen = ref(false)

const attachments = createResource({
  url: 'tatva_connect.api.notes.note_attachments',
  makeParams: () => ({ note: name.value }),
})

// Seed from the passed note each time the modal opens; load its attachments once we have a name.
watch(
  show,
  (open) => {
    if (!open) return
    name.value = props.note?.name || null
    title.value = props.note?.title || ''
    content.value = props.note?.content || ''
    error.value = null
    if (name.value) attachments.reload()
  },
  { immediate: true },
)

async function save() {
  saving.value = true
  error.value = null
  try {
    if (name.value) {
      await call('frappe.client.set_value', {
        doctype: 'FCRM Note',
        name: name.value,
        fieldname: { title: title.value, content: content.value },
      })
      emit('saved', { name: name.value, isInsert: false })
      close()
    } else {
      const doc = await call('frappe.client.insert', {
        doc: {
          doctype: 'FCRM Note',
          title: title.value,
          content: content.value,
          reference_doctype: props.defaults.reference_doctype,
          reference_docname: props.defaults.reference_docname,
        },
      })
      name.value = doc.name
      emit('saved', { name: doc.name, isInsert: true })
      toast.success(__('Note saved — you can attach files now'))
      attachments.reload()
    }
  } catch (e) {
    error.value = e?.messages?.[0] || e?.message || __('Could not save the note')
  } finally {
    saving.value = false
  }
}

function onUploaded() {
  attachments.reload()
  emit('saved', { name: name.value, isInsert: false }) // refresh attachment counts on the cards
}

async function removeAttachment(f) {
  try {
    await call('frappe.client.delete', { doctype: 'File', name: f.name })
    attachments.reload()
    emit('saved', { name: name.value, isInsert: false })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not remove the attachment'))
  }
}

function close() {
  show.value = false
}
</script>
