<template>
  <div
    v-if="title !== 'Data'"
    class="mx-4 my-3 flex items-center gap-3 text-lg font-medium sm:mx-10 sm:mb-4 sm:mt-8"
  >
    <div class="flex h-8 shrink-0 items-center text-xl font-semibold text-ink-gray-8">
      {{ __(title) }}
    </div>
    <!-- TATVA: search + Filter only when the tab actually HAS data (unfiltered). An empty tab shows
         just its empty state + the primary action button below — no point searching/filtering nothing. -->
    <FormControl
      v-if="hasToolbar && activityToolbar.hasData"
      v-model="activityToolbar.search"
      type="text"
      :placeholder="__('Search {0}…', [__(title)])"
      class="w-36 sm:w-56"
    >
      <template #prefix>
        <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
      </template>
    </FormControl>
    <div class="ml-auto flex items-center gap-2">
      <!-- TATVA: native Filter driven by the active tab's published field catalog -->
      <Filter
        v-if="hasToolbar && activityToolbar.hasData && activityToolbar.fields.length"
        v-model="activityToolbar.model"
        :doctype="toolbarDoctype"
        :fields="activityToolbar.fields"
        @update="onFilter"
      />
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
    <!-- TATVA: split-dropdown New Task + Log Activity (search/filter come from the shared toolbar above) -->
    <div v-else-if="title == 'Tasks'" class="flex items-center">
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
          icon: refreshingHistory ? null : 'chevron-down',
          loading: refreshingHistory,
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
import { whatsappEnabled, whatsappRouted, whatsappHasRole } from '@/composables/whatsapp'
import { callEnabled } from '@/composables/telephony'
import Filter from '@/components/Filter.vue' // TATVA: native filter drives the activity tabs
import { activityToolbar } from '@/tatva/activityToolbar.js'
import { filtersToPredicate } from '@/tatva/smartViewPredicate.js'
import { Dropdown, FormControl, FeatherIcon } from 'frappe-ui'
import { computed, h } from 'vue'

const props = defineProps({
  tabs: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  doc: { type: Object, default: () => ({}) },
  modalRef: { type: Object, default: () => ({}) },
  whatsappBox: { type: Object, default: () => ({}) },
  // TATVA: a WhatsApp history refresh is in flight for this record. Owned by @/tatva/whatsappRefresh
  // (module scope, realtime-driven) so it is true in every open tab, not just the one that clicked.
  refreshingHistory: { type: Boolean, default: false },
})

// TATVA: which tabs carry the shared search + Filter toolbar, and the doctype each filters on.
const TOOLBAR_DOCTYPE = {
  Comments: 'Comment',
  Notes: 'FCRM Note',
  Calls: 'CRM Call Log',
  Tasks: 'CRM Task',
  Attachments: 'File',
}
const hasToolbar = computed(() => props.title in TOOLBAR_DOCTYPE)
const toolbarDoctype = computed(() => TOOLBAR_DOCTYPE[props.title] || '')

// TATVA: native Filter -> shared predicate the active tab reads (client-side filter).
function onFilter(dict) {
  activityToolbar.model.params.filters = dict || {}
  activityToolbar.predicate = filtersToPredicate(dict)
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
      // TATVA: capability role × grain routing × global enable — consistent with the WhatsApp tab.
      condition: () =>
        whatsappEnabled.value && whatsappRouted.value && whatsappHasRole.value,
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
    label: props.refreshingHistory ? __('Refreshing…') : __('Refresh History'),
    icon: 'refresh-cw',
    // Disabled while a refresh is in flight. The server deduplicates on the same key (job_id per
    // lead), so a double click is harmless either way — this is the half the rep can SEE.
    disabled: props.refreshingHistory,
    onClick: () => !props.refreshingHistory && emit('refresh-history'),
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
