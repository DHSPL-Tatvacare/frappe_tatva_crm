<template>
  <div
    v-if="title !== 'Data'"
    class="mx-4 my-3 flex items-center justify-between text-lg font-medium sm:mx-10 sm:mb-4 sm:mt-8"
  >
    <div class="flex h-8 items-center text-xl font-semibold text-ink-gray-8">
      {{ __(title) }}
    </div>
    <Button
      v-if="title == 'Emails'"
      variant="solid"
      :label="__('New Email')"
      iconLeft="plus"
      @click="emailBox.show = true"
    />
    <Button
      v-else-if="title == 'Comments'"
      variant="solid"
      :label="__('New Comment')"
      iconLeft="plus"
      @click="emailBox.showComment = true"
    />
    <MultiActionButton
      v-else-if="title == 'Calls'"
      variant="solid"
      :options="callActions"
    />
    <Button
      v-else-if="title == 'Notes'"
      variant="solid"
      :label="__('New Note')"
      iconLeft="plus"
      @click="modalRef.showNote()"
    />
    <!-- TATVA: native Filter (status/type) for the Tasks board + split-dropdown New Task + Log Activity -->
    <div v-else-if="title == 'Tasks'" class="flex items-center gap-2">
      <Filter
        v-if="taskFilter.fields.length"
        doctype="CRM Task"
        :fields="taskFilter.fields"
        v-model="taskFilter.model"
        @update="onTaskFilter"
      />
      <div class="flex items-center">
        <Button
          variant="solid"
          class="rounded-br-none rounded-tr-none"
          :label="__('New Task')"
          iconLeft="plus"
          @click="modalRef.showTask()"
        />
        <Dropdown
          :options="taskActions"
          placement="bottom-end"
          :button="{
            icon: 'chevron-down',
            variant: 'solid',
            class: '!w-6 justify-center rounded-bl-none rounded-tl-none border-l border-l-outline-white/30 px-0',
          }"
        />
      </div>
    </div>
    <Button
      v-else-if="title == 'Attachments'"
      variant="solid"
      :label="__('Upload Attachment')"
      iconLeft="plus"
      @click="showFilesUploader = true"
    />
    <!-- TATVA: WhatsApp split button — Send Template (primary) + dropdown (Send Message, Refresh History).
         showWhatsappTemplates now opens our native TatvaWhatsAppTemplate (the crm selector is unwired). -->
    <div v-else-if="title == 'WhatsApp'" class="flex items-center shrink-0">
      <Button
        variant="solid"
        class="rounded-br-none rounded-tr-none"
        :label="__('Send Template')"
        @click="showWhatsappTemplates = true"
      >
        <template #prefix>
          <WhatsAppIcon class="h-4 w-4" />
        </template>
      </Button>
      <Dropdown
        :options="whatsappActions"
        placement="bottom-end"
        :button="{
          icon: 'chevron-down',
          variant: 'solid',
          class: '!w-6 justify-center rounded-bl-none rounded-tl-none border-l border-l-outline-white/30 px-0',
        }"
      />
    </div>
    <Dropdown v-else :options="defaultActions" @click.stop>
      <template #default="{ open }">
        <Button
          variant="solid"
          class="flex items-center gap-1"
          :label="__('New')"
          iconLeft="plus"
          :iconRight="open ? 'chevron-up' : 'chevron-down'"
        />
      </template>
    </Dropdown>
  </div>
</template>
<script setup>
import MultiActionButton from '@/components/MultiActionButton.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { globalStore } from '@/stores/global'
import { whatsappEnabled, whatsappRouted } from '@/composables/whatsapp'
import { callEnabled } from '@/composables/telephony'
import Filter from '@/components/Filter.vue' // TATVA: native filter drives the lead Tasks board
import { taskFilter } from '@/tatva/taskFilter.js'
import { filtersToPredicate } from '@/tatva/smartViewPredicate.js'
import { Dropdown } from 'frappe-ui'
import { computed, h } from 'vue'

const props = defineProps({
  tabs: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  doc: { type: Object, default: () => ({}) },
  modalRef: { type: Object, default: () => ({}) },
  whatsappBox: { type: Object, default: () => ({}) },
})

// TATVA: native Filter -> shared predicate the Tasks board reads (client-side filter).
function onTaskFilter(dict) {
  taskFilter.model.params.filters = dict || {}
  taskFilter.predicate = filtersToPredicate(dict)
}

// TATVA: Refresh History (WhatsApp dropdown) is handled by the parent (Activities owns the message resource).
const emit = defineEmits(['refresh-history'])

const { makeCall } = globalStore()

const tabIndex = defineModel({ type: Number })
const showWhatsappTemplates = defineModel('showWhatsappTemplates', {
  type: Boolean,
})
const showFilesUploader = defineModel('showFilesUploader', { type: Boolean })
const emailBox = defineModel('emailBox', { type: Object, default: () => ({}) })

const defaultActions = computed(() => {
  let actions = [
    {
      icon: h(Email2Icon, { class: 'h-4 w-4' }),
      label: __('Email'),
      onClick: () => (emailBox.value.show = true),
    },
    {
      icon: h(CommentIcon, { class: 'h-4 w-4' }),
      label: __('Comment'),
      onClick: () => (emailBox.value.showComment = true),
    },
    {
      icon: h(PhoneIcon, { class: 'h-4 w-4' }),
      label: __('Log a Call'),
      onClick: () => props.modalRef.createCallLog(),
    },
    {
      icon: h(PhoneIcon, { class: 'h-4 w-4' }),
      label: __('Make a Call'),
      onClick: () => makeCall(props.doc.mobile_no),
      condition: () => callEnabled.value,
    },
    {
      icon: h(NoteIcon, { class: 'h-4 w-4' }),
      label: __('Note'),
      onClick: () => props.modalRef.showNote(),
    },
    {
      icon: h(TaskIcon, { class: 'h-4 w-4' }),
      label: __('Task'),
      onClick: () => props.modalRef.showTask(),
    },
    {
      icon: h(AttachmentIcon, { class: 'h-4 w-4' }),
      label: __('Upload Attachment'),
      onClick: () => (showFilesUploader.value = true),
    },
    {
      icon: h(WhatsAppIcon, { class: 'h-4 w-4' }),
      label: __('WhatsApp Message'),
      onClick: () => (tabIndex.value = getTabIndex('WhatsApp')),
      // TATVA: gated by grain routing (lead-aware), consistent with the WhatsApp tab visibility.
      condition: () => whatsappEnabled.value && whatsappRouted.value,
    },
  ]
  return actions.filter((action) =>
    action.condition ? action.condition() : true,
  )
})

function getTabIndex(name) {
  return props.tabs.findIndex((tab) => tab.name === name)
}

// TATVA: secondary action for the Tasks split button. Log Activity opens the grain-scoped activity
// picker (tatva_connect, exposed on window) for the current lead.
const taskActions = [
  {
    label: __('Log Activity'),
    icon: h(TaskIcon, { class: 'h-4 w-4' }),
    onClick: () => window.__tcLogActivity?.(),
  },
]

// TATVA: WhatsApp split-button dropdown — Send Message (free-text composer) + Refresh History (pull
// from WATI). Send Template is the primary button. Order: Send Message, Refresh History.
const whatsappActions = computed(() => [
  {
    label: __('Send Message'),
    icon: h(WhatsAppIcon, { class: 'h-4 w-4' }),
    onClick: () => props.whatsappBox?.show?.(),
  },
  {
    label: __('Refresh History'),
    icon: 'refresh-cw',
    onClick: () => emit('refresh-history'),
  },
])

const callActions = computed(() => {
  let actions = [
    {
      label: __('Log a Call'),
      icon: 'plus',
      onClick: () => props.modalRef.createCallLog(),
    },
    {
      label: __('Make a Call'),
      icon: h(PhoneIcon, { class: 'h-4 w-4' }),
      onClick: () => makeCall(props.doc.mobile_no),
      condition: () => callEnabled.value,
    },
  ]

  return actions.filter((action) =>
    action.condition ? action.condition() : true,
  )
})
</script>
