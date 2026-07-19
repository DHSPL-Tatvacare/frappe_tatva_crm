<!-- eslint-disable vue/no-v-html -->
<template>
  <div>
    <div
      v-for="whatsapp in messages"
      :key="whatsapp.name"
      class="activity group flex gap-2"
      :class="[
        whatsapp.type == 'Outgoing' ? 'flex-row-reverse' : '',
        whatsapp.reaction ? 'mb-7' : 'mb-3',
      ]"
    >
      <div
        :id="whatsapp.name"
        class="group/message relative max-w-[90%] rounded-md bg-surface-gray-1 text-ink-gray-9 p-1.5 pl-2 text-base shadow-sm"
      >
        <!-- TATVA: native failure-reason tooltip (replaces the retired whatsapp_failed_reason.js DOM hack) -->
        <Tooltip
          v-if="whatsapp.status == 'failed'"
          :text="failedReasons[whatsapp.name] || __('Delivery failed')"
          class="absolute -top-2 right-0"
        >
          <Badge theme="red" :label="whatsapp.status" />
        </Tooltip>
        <div
          v-if="whatsapp.is_reply"
          class="mb-1 cursor-pointer rounded border-0 border-l-4 bg-surface-gray-3 p-2 text-ink-gray-5"
          :class="
            whatsapp.reply_to_type == 'Incoming'
              ? 'border-green-500'
              : 'border-blue-400'
          "
          @click="() => scrollToMessage(whatsapp.reply_to)"
        >
          <div
            class="mb-1 text-sm font-bold"
            :class="
              whatsapp.reply_to_type == 'Incoming'
                ? 'text-ink-green-2'
                : 'text-ink-blue-link'
            "
          >
            {{ whatsapp.reply_to_from || __('You') }}
          </div>
          <div class="flex flex-col gap-2 max-h-12 overflow-hidden">
            <div v-if="whatsapp.header" class="text-base font-semibold">
              {{ whatsapp.header }}
            </div>
            <div v-html="formatWhatsAppMessage(whatsapp.reply_message)" />
            <div v-if="whatsapp.footer" class="text-xs text-ink-gray-5">
              {{ whatsapp.footer }}
            </div>
          </div>
        </div>
        <div class="flex gap-2 justify-between">
          <div
            v-if="whatsapp.status != 'failed'"
            class="absolute -right-0.5 -top-0.5 flex cursor-pointer gap-1 rounded-full bg-surface-white pb-2 pl-2 pr-1.5 pt-1.5 opacity-0 group-hover/message:opacity-100"
            :style="{
              background:
                'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 35%, rgba(238, 130, 238, 0) 100%)',
            }"
          >
            <Dropdown :options="messageOptions(whatsapp)">
              <FeatherIcon name="chevron-down" class="size-4 text-ink-gray-5" />
            </Dropdown>
          </div>
          <div
            v-if="whatsapp.reaction"
            class="absolute -bottom-5 flex gap-1 rounded-full border bg-surface-white p-1 pb-[3px] shadow-sm"
          >
            <div class="flex size-4 items-center justify-center">
              {{ whatsapp.reaction }}
            </div>
          </div>
          <div
            v-if="whatsapp.message_type == 'Template'"
            class="flex flex-col gap-2"
          >
            <div v-if="whatsapp.header" class="text-base font-semibold">
              {{ whatsapp.header }}
            </div>
            <div v-html="formatWhatsAppMessage(whatsapp.template)" />
            <div v-if="whatsapp.footer" class="text-xs text-ink-gray-5">
              {{ whatsapp.footer }}
            </div>
          </div>
          <div
            v-else-if="whatsapp.content_type == 'text'"
            v-html="formatWhatsAppMessage(whatsapp.message)"
          />
          <div
            v-else-if="whatsapp.content_type == 'button'"
            v-html="formatWhatsAppMessage(whatsapp.message)"
          />
          <div v-else-if="whatsapp.content_type == 'image'">
            <img
              :src="whatsapp.attach"
              class="h-40 cursor-pointer rounded-md"
              @click="() => openFileInAnotherTab(whatsapp.attach)"
            />
            <div
              v-if="whatsapp.message !== whatsapp.attach"
              class="mt-1.5"
              v-html="formatWhatsAppMessage(whatsapp.message)"
            />
          </div>
          <!-- TATVA: a document bubble names the file. It showed a generic icon and the literal word
               "Document" — the rep could not tell a lab report from a consent form without opening
               every one. Name, type and size all come from the File row (M3), stamped on the row by
               tatva_connect.access.native_guards.get_whatsapp_messages. -->
          <div
            v-else-if="whatsapp.content_type == 'document'"
            class="flex w-64 cursor-pointer items-center gap-3 rounded-md p-1 hover:bg-surface-gray-2"
            @click="() => openFileInAnotherTab(whatsapp.attach)"
          >
            <div class="relative shrink-0">
              <DocumentIcon class="size-10 rounded-md text-ink-gray-4" />
              <span
                v-if="fileExtension(whatsapp)"
                class="absolute -bottom-0.5 left-0 rounded-sm bg-surface-gray-6 px-1 text-[9px] font-bold uppercase leading-tight text-ink-white"
                >{{ fileExtension(whatsapp) }}</span
              >
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-ink-gray-8">
                {{ fileLabel(whatsapp) }}
              </div>
              <div class="text-xs text-ink-gray-5">
                {{ fileMeta(whatsapp) }}
              </div>
            </div>
          </div>
          <div
            v-else-if="whatsapp.content_type == 'audio'"
            class="flex items-center gap-2"
          >
            <audio :src="whatsapp.attach" controls class="cursor-pointer" />
          </div>
          <div
            v-else-if="whatsapp.content_type == 'video'"
            class="flex-col items-center gap-2"
          >
            <video
              :src="whatsapp.attach"
              controls
              class="h-40 cursor-pointer rounded-md"
            />
            <div
              v-if="whatsapp.message !== whatsapp.attach"
              class="mt-1.5"
              v-html="formatWhatsAppMessage(whatsapp.message)"
            />
          </div>
          <div class="-mb-1 flex shrink-0 items-end gap-1 text-ink-gray-5">
            <Tooltip :text="formatDate(whatsapp.creation, 'ddd, MMM D, YYYY')">
              <div class="text-2xs">
                {{ formatDate(whatsapp.creation, 'hh:mm a') }}
              </div>
            </Tooltip>
            <div v-if="whatsapp.type == 'Outgoing'">
              <CheckIcon
                v-if="['sent', 'Success'].includes(whatsapp.status)"
                class="size-4"
              />
              <DoubleCheckIcon
                v-else-if="['read', 'delivered'].includes(whatsapp.status)"
                class="size-4"
                :class="{ 'text-ink-blue-2': whatsapp.status == 'read' }"
              />
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="whatsapp.status != 'failed'"
        class="flex items-center justify-center opacity-0 transition-all ease-in group-hover:opacity-100"
      >
        <IconPicker
          v-slot="{ togglePopover }"
          v-model="emoji"
          v-model:reaction="reaction"
          @update:modelValue="() => reactOnMessage(whatsapp.name, emoji)"
        >
          <Button
            class="rounded-full !size-6 mt-0.5"
            @click="() => (reaction = true) && togglePopover()"
          >
            <template #icon>
              <ReactIcon class="text-ink-gray-3" />
            </template>
          </Button>
        </IconPicker>
      </div>
    </div>
  </div>
</template>

<script setup>
import IconPicker from '@/components/IconPicker.vue'
import CheckIcon from '@/components/Icons/CheckIcon.vue'
import DoubleCheckIcon from '@/components/Icons/DoubleCheckIcon.vue'
import DocumentIcon from '@/components/Icons/DocumentIcon.vue'
import ReactIcon from '@/components/Icons/ReactIcon.vue'
import { formatDate, sanitizeHTML } from '@/utils'
import { useTelemetry } from 'frappe-ui/frappe'
import { Tooltip, Dropdown, createResource, toast } from 'frappe-ui'
import { ref } from 'vue'

defineProps({
  messages: { type: Array, default: () => [] },
  // TATVA: {whatsapp_message_name: failure_reason} for the failed-bubble tooltip.
  failedReasons: { type: Object, default: () => ({}) },
})

const list = defineModel({ type: Object })

const { capture } = useTelemetry()

function openFileInAnotherTab(url) {
  window.open(url, '_blank')
}

// TATVA: document bubble details. The File row is the source (M3) — `file_name` and `file_size` are
// stamped onto the message row server-side; the body is the provider's caption and is NOT a filename.
function fileLabel(whatsapp) {
  return whatsapp.file_name || whatsapp.message || __('Document')
}

function fileExtension(whatsapp) {
  const name = whatsapp.file_name || whatsapp.message || ''
  const ext = name.includes('.') ? name.split('.').pop() : ''
  // A 12-character "extension" is a filename with a dot in it, not a type.
  return ext && ext.length <= 5 ? ext : ''
}

function fileSize(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value = value / 1024
    unit += 1
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

function fileMeta(whatsapp) {
  // Size is absent for a row whose File was never resolved — show the type alone rather than "· ".
  return [fileExtension(whatsapp).toUpperCase(), fileSize(whatsapp.file_size)]
    .filter(Boolean)
    .join(' · ')
}

function formatWhatsAppMessage(message) {
  // TATVA: a null body is not hypothetical — an image or video sent with NO caption has one, and
  // this runs inside render(), so the TypeError tore down the component and blanked the WHOLE
  // thread, not just that bubble. Guarded here because render must never throw; the write paths
  // also floor the column so a null cannot be stored in the first place.
  if (!message) return ''

  // if message contains _text_, make it italic
  message = message.replace(/_(.*?)_/g, '<i>$1</i>')
  // if message contains *text*, make it bold
  message = message.replace(/\*(.*?)\*/g, '<b>$1</b>')
  // if message contains ~text~, make it strikethrough
  message = message.replace(/~(.*?)~/g, '<s>$1</s>')
  // if message contains ```text```, make it monospace
  message = message.replace(/```(.*?)```/g, '<code>$1</code>')
  // if message contains `text`, make it inline code
  message = message.replace(/`(.*?)`/g, '<code>$1</code>')
  // if message contains > text, make it a blockquote
  message = message.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
  // if contain /n, make it a new line
  message = message.replace(/\n/g, '<br>')
  // if contains *<space>text, make it a bullet point
  message = message.replace(/\* (.*?)(?=\s*\*|$)/g, '<li>$1</li>')
  message = message.replace(/- (.*?)(?=\s*-|$)/g, '<li>$1</li>')
  message = message.replace(/(\d+)\. (.*?)(?=\s*(\d+)\.|$)/g, '<li>$2</li>')

  return sanitizeHTML(message)
}

const emoji = ref('')
const reaction = ref(true)

function reactOnMessage(name, emoji) {
  createResource({
    url: 'crm.api.whatsapp.react_on_whatsapp_message',
    params: {
      emoji,
      reply_to_name: name,
    },
    auto: true,
    onSuccess() {
      capture('whatsapp_react_on_message')
      list.value.reload()
    },
    onError(error) {
      toast.error(
        error.messages?.[0] || __('Failed to add reaction to the message'),
      )
    },
  })
}

const reply = defineModel('reply', { type: Object, default: () => ({}) })
const replyMode = ref(false)

function messageOptions(message) {
  return [
    {
      label: 'Reply',
      onClick: () => {
        replyMode.value = true
        reply.value = {
          ...message,
          message: formatWhatsAppMessage(message.message),
        }
      },
    },
    // {
    //   label: 'Forward',
    //   onClick: () => console.log('Forward'),
    // },
    // {
    //   label: 'Delete',
    //   onClick: () => console.log('Delete'),
    // },
  ]
}

function scrollToMessage(name) {
  const element = document.getElementById(name)
  element.scrollIntoView({ behavior: 'smooth' })

  // Highlight the message
  element.classList.add('bg-yellow-100')
  setTimeout(() => {
    element.classList.remove('bg-yellow-100')
  }, 1000)
}
</script>
