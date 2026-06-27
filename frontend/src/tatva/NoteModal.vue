<!--
  NoteModal — the ONE note create/edit modal (lead/deal Notes tab + the Notes main page).

  100% native controls: a Data title (FormControl), the same full-formatting rich editor the native
  doctype form uses (TextEditorControl, fixedMenu = the formatting toolbar/headers), and the native
  permission-scoped Link control for linking a lead. NOTHING touches the backend until Save:

    • Attachments are STAGED in memory (just the file name shown) and uploaded only on Save, via the
      native upload handler -> File doc_events own the Azure lifecycle (private; proxy file_url).
    • Removing an existing attachment is staged too; applied on Save.
    • Save = insert/update the note, then apply attachment add/remove. No eager writes, no background.

  Lead linkage:
    • Opened from a lead/deal (defaults.reference_docname set) -> the link is implied, picker hidden.
    • Opened standalone (Notes page) -> a native <Link doctype="CRM Lead"> picker that, via
      frappe.desk.search.search_link, only shows leads the user is permitted to see (scoped server-side).

  Lives in tatva/ (additive).
-->
<template>
  <Dialog v-model="show" :options="{ size: 'xl' }">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
            {{ name ? __('Edit Note') : __('Create Note') }}
          </h3>
          <Button variant="ghost" class="w-7" icon="x" @click="close" />
        </div>

        <!-- Contained body: grows with content, scrolls internally (no DOM height hacks). -->
        <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          <FormControl
            v-model="title"
            :label="__('Title')"
            :placeholder="__('Note title')"
          />

          <div>
            <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Content') }}</div>
            <TextEditorControl
              :value="content"
              variant="outline"
              size="md"
              :placeholder="__('Write a note…')"
              @change="content = $event"
            />
          </div>

          <!-- Lead link only when NOT already in a lead/deal context. -->
          <div v-if="showLeadLink">
            <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Link a lead') }}</div>
            <Link
              doctype="CRM Lead"
              :value="leadLink"
              :placeholder="__('Search leads you can access…')"
              @change="leadLink = $event"
            />
          </div>

          <!-- Attachments — staged, applied on Save -->
          <div>
            <div class="mb-2 flex items-center justify-between">
              <div class="text-xs font-medium text-ink-gray-5">{{ __('Attachments') }}</div>
              <Button
                variant="subtle"
                :label="__('Attach')"
                iconLeft="paperclip"
                @click="pickFiles"
              />
              <input
                ref="fileInput"
                type="file"
                multiple
                class="hidden"
                @change="onFilesPicked"
              />
            </div>
            <div
              v-if="visibleAttachments.length || stagedFiles.length"
              class="flex flex-col gap-1.5"
            >
              <div
                v-for="f in visibleAttachments"
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
                  @click="stageRemove(f)"
                >
                  <FeatherIcon name="x" class="size-3.5 text-ink-gray-5 hover:text-ink-gray-8" />
                </button>
              </div>
              <div
                v-for="(f, i) in stagedFiles"
                :key="`staged-${i}`"
                class="flex items-center gap-2 rounded border border-dashed border-outline-gray-2 px-2.5 py-1.5"
              >
                <FeatherIcon name="paperclip" class="size-3.5 shrink-0 text-ink-gray-5" />
                <span class="truncate text-sm text-ink-gray-8">{{ f.name }}</span>
                <span class="shrink-0 text-xs text-ink-gray-4">{{ __('pending save') }}</span>
                <button
                  class="ml-auto shrink-0"
                  :title="__('Remove')"
                  @click="unstage(i)"
                >
                  <FeatherIcon name="x" class="size-3.5 text-ink-gray-5 hover:text-ink-gray-8" />
                </button>
              </div>
            </div>
            <div v-else class="text-xs text-ink-gray-4">
              {{ __('No attachments.') }}
            </div>
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
          <Button :label="__('Cancel')" @click="close" />
        </div>
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import TextEditorControl from '@/components/Controls/TextEditorControl.vue'
import FilesUploadHandler from '@/components/FilesUploader/filesUploaderHandler'
import {
  Dialog,
  FormControl,
  Button,
  FeatherIcon,
  ErrorMessage,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { ref, computed, watch } from 'vue'

const props = defineProps({
  note: { type: Object, default: null }, // existing note (edit) or null (create)
  defaults: { type: Object, default: () => ({}) }, // {reference_doctype, reference_docname} from a lead/deal
})

const show = defineModel({ type: Boolean })
const emit = defineEmits(['saved'])

const name = ref(null)
const title = ref('')
const content = ref('')
const leadLink = ref('')
const saving = ref(false)
const error = ref(null)

const fileInput = ref(null)
const stagedFiles = ref([]) // raw File objects to upload on Save
const removedNames = ref(new Set()) // existing File names staged for deletion on Save

// Hide the lead picker when opened in a lead/deal context (linkage implied).
const showLeadLink = computed(() => !props.defaults?.reference_docname)

const attachments = createResource({
  url: 'tatva_connect.api.notes.note_attachments',
  makeParams: () => ({ note: name.value }),
})

const visibleAttachments = computed(() =>
  (attachments.data || []).filter((f) => !removedNames.value.has(f.name)),
)

// Authoritative title/content for an existing note (a list row may omit `content`).
const noteDoc = createResource({
  url: 'frappe.client.get_value',
  makeParams: () => ({
    doctype: 'FCRM Note',
    filters: { name: name.value },
    fieldname: ['title', 'content'],
  }),
  onSuccess: (d) => {
    if (!d) return
    title.value = d.title || ''
    content.value = d.content || ''
  },
})

watch(
  show,
  (open) => {
    if (!open) return
    name.value = props.note?.name || null
    title.value = props.note?.title || ''
    content.value = props.note?.content || ''
    leadLink.value =
      props.note?.reference_docname || props.defaults?.reference_docname || ''
    stagedFiles.value = []
    removedNames.value = new Set()
    error.value = null
    if (name.value) {
      noteDoc.reload()
      attachments.reload()
    } else {
      attachments.data = []
    }
  },
  { immediate: true },
)

function pickFiles() {
  fileInput.value?.click()
}

function onFilesPicked(e) {
  const picked = Array.from(e.target.files || [])
  stagedFiles.value = [...stagedFiles.value, ...picked]
  e.target.value = '' // allow re-picking the same file
}

function unstage(i) {
  stagedFiles.value.splice(i, 1)
}

function stageRemove(f) {
  removedNames.value = new Set(removedNames.value).add(f.name)
}

// Upload one staged file to the saved note (native upload -> Azure hooks own privacy/offload).
function uploadOne(file, noteName) {
  return new FilesUploadHandler().upload(file, {
    fileObj: file,
    private: true,
    folder: 'Home',
    doctype: 'FCRM Note',
    docname: noteName,
  })
}

async function applyAttachments(noteName) {
  for (const fname of removedNames.value) {
    await call('frappe.client.delete', { doctype: 'File', name: fname })
  }
  for (const file of stagedFiles.value) {
    await uploadOne(file, noteName)
  }
}

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = null
  try {
    let noteName = name.value
    // Standalone (Notes page) -> the picker links a CRM Lead. In a lead/deal context -> use that
    // context's reference (CRM Lead OR CRM Deal), never assume Lead.
    const reference_docname = showLeadLink.value
      ? leadLink.value || null
      : props.defaults?.reference_docname || null
    const reference_doctype = reference_docname
      ? showLeadLink.value
        ? 'CRM Lead'
        : props.defaults?.reference_doctype
      : null
    const refFields = reference_docname
      ? { reference_doctype, reference_docname }
      : {}

    if (noteName) {
      await call('frappe.client.set_value', {
        doctype: 'FCRM Note',
        name: noteName,
        fieldname: { title: title.value, content: content.value, ...refFields },
      })
    } else {
      const doc = await call('frappe.client.insert', {
        doc: {
          doctype: 'FCRM Note',
          title: title.value,
          content: content.value,
          ...refFields,
        },
      })
      noteName = doc.name
    }

    await applyAttachments(noteName)
    emit('saved', { name: noteName, isInsert: !name.value })
    close()
  } catch (e) {
    error.value =
      e?.messages?.[0] || e?.message || __('Could not save the note')
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}

function close() {
  show.value = false
}
</script>
