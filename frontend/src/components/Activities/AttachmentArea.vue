<template>
  <div v-if="attachments.length">
    <div v-for="(attachment, i) in attachments" :key="attachment.name">
      <div
        class="activity flex justify-between gap-2 hover:bg-surface-menu-bar rounded text-base p-2.5 cursor-pointer"
        @click="openFile(attachment)"
      >
        <div class="flex gap-2 truncate">
          <div
            class="size-11 bg-surface-white rounded overflow-hidden flex-shrink-0 flex justify-center items-center"
            :class="{ border: !isImage(attachment.file_type) }"
          >
            <img
              v-if="isImage(attachment.file_type)"
              class="size-full object-cover"
              :src="attachment.file_url"
              :alt="attachment.file_name"
            />
            <component
              :is="fileIcon(attachment.file_type)"
              v-else
              class="size-4 text-ink-gray-7"
            />
          </div>
          <div class="flex flex-col justify-center gap-1 truncate">
            <div class="flex items-center gap-1.5 min-w-0">
              <div class="text-base text-ink-gray-8 truncate">
                {{ attachment.file_name }}
              </div>
              <!-- TATVA: document-review verdict badge — shown only when the File carries a
                   custom_review_status; blank (never reviewed) renders nothing. -->
              <Badge
                v-if="attachment.custom_review_status"
                class="flex-shrink-0"
                :theme="reviewTheme(attachment.custom_review_status)"
                :label="__(attachment.custom_review_status)"
              />
            </div>
            <div class="mb-1 text-sm text-ink-gray-5">
              {{ convertSize(attachment.file_size) }}
            </div>
          </div>
        </div>
        <div class="flex flex-col items-end gap-2 flex-shrink-0">
          <Tooltip :text="formatDate(attachment.creation)">
            <div class="text-sm text-ink-gray-5">
              {{ __(timeAgo(attachment.creation)) }}
            </div>
          </Tooltip>
          <div class="flex gap-1">
            <!-- TATVA: the tab aggregates every surface a file can arrive through. The file still lives on
                 that record, so name the surface — a rep must know why a note's document is listed on the
                 lead, and where deleting it takes effect. Blank source = filed on the lead itself. -->
            <Tooltip
              v-if="attachment.source"
              :text="__('Added on {0}', [__(attachment.source)])"
            >
              <div class="flex size-5 items-center justify-center">
                <component
                  :is="sourceIcon(attachment.source)"
                  class="size-3 text-ink-gray-5"
                />
              </div>
            </Tooltip>
            <!-- TATVA: privacy is decided by ONE checkpoint on the server (the operator's public-doctype
                 allowlist), never by the viewer — a "Make Public" action here would be overruled on save
                 and the file would silently flip back. So this is state, not a control.
                 An external link is not a file we hold: we never received its bytes, never screened them,
                 and the browser fetches it from that host, not through us. Show it as a link — a padlock
                 beside a public URL tells the rep something untrue about who can see it. -->
            <Tooltip
              :text="
                isExternal(attachment)
                  ? __('External link — not stored or screened by us')
                  : attachment.is_private
                    ? __('Private')
                    : __('Public')
              "
            >
              <div class="flex size-5 items-center justify-center">
                <FeatherIcon
                  :name="
                    isExternal(attachment)
                      ? 'link'
                      : attachment.is_private
                        ? 'lock'
                        : 'unlock'
                  "
                  class="size-3 text-ink-gray-5"
                />
              </div>
            </Tooltip>
            <Button
              :tooltip="__('Delete Attachment')"
              class="!size-5"
              @click.stop="() => deleteAttachment(attachment.name)"
            >
              <template #icon>
                <FeatherIcon name="trash-2" class="size-3 text-ink-gray-7" />
              </template>
            </Button>
          </div>
        </div>
      </div>
      <div
        v-if="i < attachments.length - 1"
        class="mx-2 h-px border-t border-outline-gray-modals"
      />
    </div>
  </div>
</template>
<script setup>
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import FileAudioIcon from '@/components/Icons/FileAudioIcon.vue'
import FileTextIcon from '@/components/Icons/FileTextIcon.vue'
import FileVideoIcon from '@/components/Icons/FileVideoIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { globalStore } from '@/stores/global'
import { call, Badge, Tooltip } from 'frappe-ui'
import { formatDate, timeAgo, convertSize, isImage } from '@/utils'

defineProps({
  attachments: { type: Array, default: () => [] },
})

// TATVA: the surface a file came in through, as the same icon that labels that surface elsewhere in the
// app — the tabs, the activity feed. `source` is set by crm.api.activities.get_attachments; a file filed
// directly on the lead has none, and shows no icon.
const SOURCE_ICONS = {
  Comment: CommentIcon,
  Note: NoteIcon,
  Task: TaskIcon,
  Email: EmailIcon,
  WhatsApp: WhatsAppIcon,
}

function sourceIcon(source) {
  return SOURCE_ICONS[source]
}

// TATVA: a file whose URL points at another host — added via the uploader's "Web Link" tab. Its bytes
// never reach us, so it is neither stored, screened, nor served through our permission gate.
function isExternal(attachment) {
  return /^https?:\/\//.test(attachment.file_url || '')
}

// TATVA: map the File's document-review verdict to a token-based Badge theme.
// Approved → success (green), Rejected → red, anything else (Pending) → neutral gray.
function reviewTheme(status) {
  if (status === 'Approved') return 'green'
  if (status === 'Rejected') return 'red'
  return 'gray'
}

const emit = defineEmits(['reload'])

const { $dialog } = globalStore()

function openFile(attachment) {
  window.open(attachment.file_url, '_blank')
}

function deleteAttachment(fileName) {
  $dialog({
    title: __('Delete Attachment'),
    message: __('Are you sure you want to delete this attachment?'),
    actions: [
      {
        label: __('Delete'),
        variant: 'solid',
        theme: 'red',
        onClick: async (close) => {
          await call('frappe.client.delete', {
            doctype: 'File',
            name: fileName,
          })
          emit('reload')
          close()
        },
      },
    ],
  })
}

function fileIcon(type) {
  if (!type) return FileTextIcon
  let audioExtentions = ['wav', 'mp3', 'ogg', 'flac', 'aac']
  let videoExtentions = ['mp4', 'avi', 'mkv', 'flv', 'mov']
  if (audioExtentions.includes(type.toLowerCase())) {
    return FileAudioIcon
  } else if (videoExtentions.includes(type.toLowerCase())) {
    return FileVideoIcon
  }
  return FileTextIcon
}
</script>
