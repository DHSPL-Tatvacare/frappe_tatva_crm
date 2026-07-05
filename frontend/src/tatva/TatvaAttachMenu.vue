<!--
  TATVA: native composer attach menu — replaces the retired email_attach.js DOM/localStorage hack.
  Two paths, BOTH stage an UNATTACHED File in Home/Email Drafts (via tatva_connect.api.email) so nothing
  lands on the lead's Attachments tab: "from device" (a FileUploader pointed at the drafts folder) and
  "from CRM" (pick this lead's real files -> stage_crm_file copies them, sharing the same file_url/Azure
  blob, original untouched). Each picked File is emitted via @select; the composer pushes it into its
  reactive `attachments`, so it attaches on send and is discarded on cancel by the native lifecycle.
  Native frappe-ui only; additive (frontend/src/tatva/). Lives beside the composer's own icons.
-->
<template>
  <Button
    :tooltip="__('Attach a File')"
    :icon="AttachmentIcon"
    variant="ghost"
    @click="openMenu"
  />

  <ResponsiveDialog v-model="show" :options="{ size: 'sm', title: __('Attach') }">
    <template #body-content>
      <div class="flex flex-col gap-1 overflow-y-auto pr-0.5 sm:max-h-[60vh]">
        <template v-if="mode === 'menu'">
          <FileUploader
            :upload-args="{ folder: DRAFT_FOLDER, private: true }"
            @success="onStaged"
          >
            <template #default="{ openFileSelector }">
              <button class="tc-attach-row" @click="openFileSelector()">
                <FeatherIcon name="upload" class="h-4 w-4 shrink-0 text-ink-gray-6" />
                <span class="text-sm text-ink-gray-8">{{ __('Attach from device') }}</span>
              </button>
            </template>
          </FileUploader>
          <button class="tc-attach-row" @click="loadCrmFiles">
            <FeatherIcon name="grid" class="h-4 w-4 shrink-0 text-ink-gray-6" />
            <span class="text-sm text-ink-gray-8">{{ __('Attach from CRM') }}</span>
          </button>
        </template>

        <template v-else>
          <div class="pb-1 text-xs text-ink-gray-5">
            {{ __('Picked files attach when you send — and are left untouched if you discard.') }}
          </div>
          <FormControl
            v-if="crmFiles.length"
            v-model="search"
            type="text"
            :placeholder="__('Search files…')"
          />
          <div v-if="!crmFiles.length" class="py-6 text-center text-sm text-ink-gray-5">
            {{ __('No files on this lead yet. Use “Attach from device”.') }}
          </div>
          <div v-else-if="!filteredFiles.length" class="py-6 text-center text-sm text-ink-gray-5">
            {{ __('No matching files') }}
          </div>
          <button
            v-for="f in filteredFiles"
            :key="f.name"
            class="tc-attach-row"
            :class="{ 'bg-surface-gray-3': staged.has(f.file_name) }"
            :disabled="staging === f.name"
            @click="pickCrmFile(f)"
          >
            <FeatherIcon name="file" class="h-4 w-4 shrink-0 text-ink-gray-6" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm text-ink-gray-8">{{ f.file_name }}</div>
              <div class="text-xs text-ink-gray-5">
                {{ humanSize(f.file_size) }}<span v-if="f.is_private"> · {{ __('private') }}</span>
              </div>
            </div>
            <FeatherIcon
              v-if="staged.has(f.file_name)"
              name="check"
              class="ml-auto h-4 w-4 text-ink-gray-7"
            />
          </button>
        </template>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, FileUploader, FormControl, FeatherIcon, call, toast } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'

const DRAFT_FOLDER = 'Home/Email Drafts'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
})
const emit = defineEmits(['select'])

const show = ref(false)
const mode = ref('menu')
const crmFiles = ref([])
const search = ref('')
const staged = ref(new Set()) // file_name of files already picked this open
const staging = ref(null)

function openMenu() {
  mode.value = 'menu'
  search.value = ''
  show.value = true
}

const filteredFiles = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q
    ? crmFiles.value.filter((f) => (f.file_name || '').toLowerCase().includes(q))
    : crmFiles.value
})

function humanSize(n) {
  n = +n || 0
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return (i ? n.toFixed(1) : n) + ' ' + u[i]
}

// Device: the FileUploader already staged the file (drafts folder, unattached) — hand it to the composer.
function onStaged(file) {
  emit('select', { name: file.name, file_url: file.file_url, file_name: file.file_name })
  toast.success(__('Attached {0}', [file.file_name]))
  show.value = false
}

async function loadCrmFiles() {
  try {
    crmFiles.value =
      (await call('tatva_connect.api.email.list_attachable_files', {
        reference_doctype: props.doctype,
        reference_name: props.docname,
      })) || []
    staged.value = new Set()
    mode.value = 'crm'
  } catch (e) {
    toast.error(__('Could not load files'))
  }
}

async function pickCrmFile(f) {
  if (staged.value.has(f.file_name) || staging.value) return
  staging.value = f.name
  try {
    const draft = await call('tatva_connect.api.email.stage_crm_file', {
      reference_doctype: props.doctype,
      reference_name: props.docname,
      source_file: f.name,
    })
    if (draft) {
      emit('select', draft)
      staged.value = new Set(staged.value).add(f.file_name)
      toast.success(__('Attached {0}', [draft.file_name]))
    }
  } catch (e) {
    toast.error(__('Could not attach'))
  } finally {
    staging.value = null
  }
}
</script>

<style scoped>
.tc-attach-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.375rem;
  padding: 0.625rem 0.75rem;
  text-align: left;
}
.tc-attach-row:hover:not(:disabled) {
  background: var(--surface-gray-2);
}
</style>
