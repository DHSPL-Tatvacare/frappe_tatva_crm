<template>
  <ActivityHeader
    v-model="tabIndex"
    v-model:showWhatsappTemplates="showWhatsappTemplates"
    v-model:showFilesUploader="showFilesUploader"
    v-model:emailBox="emailBox"
    :tabs="tabs"
    :title="title"
    :doc="doc"
    :whatsappBox="whatsappBox"
    :modalRef="modalRef"
    :refreshing-history="refreshingHistory"
    @refresh-history="refreshHistory"
  />
  <FadedScrollableDiv class="flex flex-col h-full overflow-y-auto">
    <div
      v-if="all_activities?.loading"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-xl font-medium text-ink-gray-4"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span>{{ __('Loading...') }}</span>
    </div>
    <!-- TATVA: native config-driven task board — ALWAYS mounted for a lead's Tasks tab so it works
         with zero tasks too (first activity can be logged; board fetches its own data). -->
    <div
      v-else-if="title === 'Tasks' && doctype === 'CRM Lead'"
      class="flex flex-1 flex-col px-3 pb-3 sm:px-10 sm:pb-5"
    >
      <TatvaTasks :lead="doc?.name" />
    </div>
    <div v-else-if="hasVisibleContent" class="activities">
      <div v-if="title == 'WhatsApp' && whatsappMessages.data?.length">
        <WhatsAppArea
          v-model="whatsappMessages"
          v-model:reply="replyMessage"
          class="px-3 sm:px-10"
          :messages="whatsappMessages.data"
          :failedReasons="failedReasons.data || {}"
        />
      </div>
      <!-- TATVA: Notes tab adopts the unified activity-card shape (timeline rail + "added a note"
           header + content block), matching Calls/Comments. Replaces the tall 3-col grid via
           <NoteCard>; native NoteArea is untouched (no upstream divergence). -->
      <div v-else-if="title == 'Notes'" class="pb-5">
        <div v-for="(note, i) in displayActivities" :key="note.name">
          <div
            class="activity grid grid-cols-[30px_minmax(auto,_1fr)] gap-2 px-3 sm:gap-4 sm:px-10"
          >
            <div
              class="z-0 relative flex justify-center before:absolute before:left-[50%] before:-z-[1] before:top-0 before:border-l before:border-outline-gray-modals"
              :class="
                i != displayActivities.length - 1 ? 'before:h-full' : 'before:h-4'
              "
            >
              <div
                class="flex h-8 w-7 items-center justify-center bg-surface-white"
              >
                <NoteIcon class="text-ink-gray-8" />
              </div>
            </div>
            <div class="mb-4 min-w-0" @click="modalRef.showNote(note)">
              <NoteCard v-model="all_activities" :note="note" />
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="title == 'Comments'" class="pb-5">
        <div v-for="(comment, i) in displayActivities" :key="comment.name">
          <div
            class="activity grid grid-cols-[30px_minmax(auto,_1fr)] gap-2 px-3 sm:gap-4 sm:px-10"
          >
            <div
              class="z-0 relative flex justify-center before:absolute before:left-[50%] before:-z-[1] before:top-0 before:border-l before:border-outline-gray-modals"
              :class="
                i != displayActivities.length - 1 ? 'before:h-full' : 'before:h-4'
              "
            >
              <div
                class="flex h-8 w-7 items-center justify-center bg-surface-white"
              >
                <CommentIcon class="text-ink-gray-8" />
              </div>
            </div>
            <CommentArea
              class="mb-4"
              :activity="comment"
              @reload="all_activities.reload()"
            />
          </div>
        </div>
      </div>
      <div v-else-if="title == 'Tasks'" class="px-3 pb-3 sm:px-10 sm:pb-5">
        <!-- TATVA: leads use the always-mounted board above; deals/other doctypes use native TaskArea. -->
        <TaskArea :modalRef="modalRef" :tasks="displayActivities" :doctype="doctype" />
      </div>
      <div v-else-if="title == 'Calls'" class="activity">
        <div v-for="(call, i) in displayActivities" :key="call.name">
          <div
            class="activity grid grid-cols-[30px_minmax(auto,_1fr)] gap-4 px-3 sm:px-10"
          >
            <div
              class="z-0 relative flex justify-center before:absolute before:left-[50%] before:-z-[1] before:top-0 before:border-l before:border-outline-gray-modals"
              :class="
                i != displayActivities.length - 1 ? 'before:h-full' : 'before:h-4'
              "
            >
              <div
                class="flex h-8 w-7 items-center justify-center bg-surface-white text-ink-gray-8"
              >
                <MissedCallIcon
                  v-if="call.status == 'No Answer'"
                  class="text-ink-red-4"
                />
                <DeclinedCallIcon v-else-if="call.status == 'Busy'" />
                <component
                  :is="
                    call.type == 'Incoming' ? InboundCallIcon : OutboundCallIcon
                  "
                  v-else
                />
              </div>
            </div>
            <CallArea class="mb-4" :activity="call" />
          </div>
        </div>
      </div>
      <div
        v-else-if="title == 'Attachments'"
        class="px-3 pb-3 sm:px-10 sm:pb-5"
      >
        <AttachmentArea
          :attachments="displayActivities"
          @reload="all_activities.reload() && scroll()"
        />
      </div>
      <template v-else>
        <div
          v-for="(activity, i) in activities"
          :key="activity.name"
          class="activity px-3 sm:px-10"
          :class="
            ['Activity', 'Emails'].includes(title)
              ? 'grid grid-cols-[30px_minmax(auto,_1fr)] gap-2 sm:gap-4'
              : ''
          "
        >
          <div
            v-if="['Activity', 'Emails'].includes(title)"
            class="z-0 relative flex justify-center before:absolute before:left-[50%] before:-z-[1] before:top-0 before:border-l before:border-outline-gray-modals"
            :class="[
              i != activities.length - 1 ? 'before:h-full' : 'before:h-4',
            ]"
          >
            <div
              class="flex h-7 w-7 items-center justify-center bg-surface-white"
              :class="{
                'mt-2.5': ['communication'].includes(activity.activity_type),
                'bg-surface-white': ['added', 'removed', 'changed'].includes(
                  activity.activity_type,
                ),
                'h-8': [
                  'comment',
                  'communication',
                  'incoming_call',
                  'outgoing_call',
                ].includes(activity.activity_type),
              }"
            >
              <UserAvatar
                v-if="activity.activity_type == 'communication'"
                :user="activity.data.sender"
                size="md"
              />
              <MissedCallIcon
                v-else-if="
                  ['incoming_call', 'outgoing_call'].includes(
                    activity.activity_type,
                  ) && activity.status == 'No Answer'
                "
                class="text-ink-red-4"
              />
              <DeclinedCallIcon
                v-else-if="
                  ['incoming_call', 'outgoing_call'].includes(
                    activity.activity_type,
                  ) && activity.status == 'Busy'
                "
              />
              <component
                :is="activity.icon"
                v-else
                :class="
                  ['added', 'removed', 'changed'].includes(
                    activity.activity_type,
                  )
                    ? 'text-ink-gray-4'
                    : 'text-ink-gray-8'
                "
              />
            </div>
          </div>
          <div
            v-if="activity.activity_type == 'communication'"
            class="pb-5 mt-px"
          >
            <EmailArea :activity="activity" :emailBox="emailBox" />
          </div>
          <div
            v-else-if="activity.activity_type == 'comment'"
            :id="activity.name"
            class="mb-4"
          >
            <CommentArea
              :activity="activity"
              @reload="all_activities.reload()"
            />
          </div>
          <div
            v-else-if="activity.activity_type == 'attachment_log'"
            :id="activity.name"
            class="mb-4 flex flex-col gap-2 py-1.5"
          >
            <div class="flex items-center justify-stretch gap-2 text-base">
              <div
                class="inline-flex items-center flex-wrap gap-1.5 text-ink-gray-8 font-medium"
              >
                <span class="font-medium">{{ activity.owner_name }}</span>
                <span class="text-ink-gray-5">{{
                  __(activity.data.type)
                }}</span>
                <a
                  v-if="activity.data.file_url"
                  :href="activity.data.file_url"
                  target="_blank"
                >
                  <span>{{ activity.data.file_name }}</span>
                </a>
                <span v-else>{{ activity.data.file_name }}</span>
                <FeatherIcon
                  v-if="activity.data.is_private"
                  name="lock"
                  class="size-3"
                />
              </div>
              <div class="ml-auto whitespace-nowrap">
                <Tooltip :text="formatDate(activity.creation)">
                  <div class="text-sm text-ink-gray-5">
                    {{ __(timeAgo(activity.creation)) }}
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>
          <div
            v-else-if="
              activity.activity_type == 'incoming_call' ||
              activity.activity_type == 'outgoing_call'
            "
            class="mb-4"
          >
            <CallArea :activity="activity" />
          </div>
          <!-- TATVA: our synthetic per-lead audit rows (logged activity / stage move / task) -->
          <div
            v-else-if="TATVA_AUDIT_TYPES.includes(activity.activity_type)"
            :id="activity.name"
            class="mb-4"
          >
            <ActivityAuditEntry :activity="activity" />
          </div>
          <div v-else class="mb-4 flex flex-col gap-2 py-1.5">
            <div class="flex items-center justify-stretch gap-2 text-base">
              <div
                v-if="activity.other_versions"
                class="inline-flex flex-wrap gap-1.5 text-ink-gray-8 font-medium"
              >
                <span>{{
                  activity.show_others ? __('Hide') : __('Show')
                }}</span>
                <span> +{{ activity.other_versions.length + 1 }} </span>
                <span>{{ __('changes from') }}</span>
                <span>{{ activity.owner_name }}</span>
                <Button
                  class="!size-4"
                  variant="ghost"
                  :icon="SelectIcon"
                  @click="activity.show_others = !activity.show_others"
                />
              </div>
              <div
                v-else
                class="inline-flex items-center flex-wrap gap-1 text-ink-gray-5"
              >
                <span class="font-medium text-ink-gray-8">
                  {{ activity.owner_name }}
                </span>
                <span v-if="activity.type">{{ __(activity.type) }}</span>
                <span
                  v-if="activity.data?.field_label"
                  class="max-w-xs truncate font-medium text-ink-gray-8"
                >
                  {{ __(activity.data.field_label) }}
                </span>
                <span v-if="activity.value">{{ __(activity.value) }}</span>
                <span
                  v-if="activity.data?.old_value"
                  class="max-w-xs font-medium text-ink-gray-8"
                >
                  <div
                    v-if="activity.options == 'User'"
                    class="flex items-center gap-1"
                  >
                    <UserAvatar :user="activity.data.old_value" size="xs" />
                    {{ getUser(activity.data.old_value).full_name }}
                  </div>
                  <div v-else class="truncate">
                    {{ activity.data.old_value }}
                  </div>
                </span>
                <span v-if="activity.to">{{ __('to') }}</span>
                <span
                  v-if="activity.data?.value"
                  class="max-w-xs font-medium text-ink-gray-8"
                >
                  <div
                    v-if="activity.options == 'User'"
                    class="flex items-center gap-1"
                  >
                    <UserAvatar :user="activity.data.value" size="xs" />
                    {{ getUser(activity.data.value).full_name }}
                  </div>
                  <div v-else class="truncate">
                    {{ activity.data.value }}
                  </div>
                </span>
              </div>

              <div class="ml-auto whitespace-nowrap">
                <Tooltip :text="formatDate(activity.creation)">
                  <div class="text-sm text-ink-gray-5">
                    {{ __(timeAgo(activity.creation)) }}
                  </div>
                </Tooltip>
              </div>
            </div>
            <div
              v-if="activity.other_versions && activity.show_others"
              class="flex flex-col gap-0.5"
            >
              <div
                v-for="a in sortByCreation([
                  activity,
                  ...activity.other_versions,
                ])"
                :key="a.creation"
                class="flex items-start justify-stretch gap-2 py-1.5 text-base"
              >
                <div class="inline-flex flex-wrap gap-1 text-ink-gray-5">
                  <span
                    v-if="a.data?.field_label"
                    class="max-w-xs truncate text-ink-gray-5"
                  >
                    {{ __(a.data.field_label) }}
                  </span>
                  <FeatherIcon
                    name="arrow-right"
                    class="mx-1 h-4 w-4 text-ink-gray-5"
                  />
                  <span v-if="a.type">
                    {{ startCase(__(a.type)) }}
                  </span>
                  <span
                    v-if="a.data?.old_value"
                    class="max-w-xs font-medium text-ink-gray-8"
                  >
                    <div
                      v-if="a.options == 'User'"
                      class="flex items-center gap-1"
                    >
                      <UserAvatar :user="a.data.old_value" size="xs" />
                      {{ getUser(a.data.old_value).full_name }}
                    </div>
                    <div v-else class="truncate">
                      {{ a.data.old_value }}
                    </div>
                  </span>
                  <span v-if="a.to">{{ __('to') }}</span>
                  <span
                    v-if="a.data?.value"
                    class="max-w-xs font-medium text-ink-gray-8"
                  >
                    <div
                      v-if="a.options == 'User'"
                      class="flex items-center gap-1"
                    >
                      <UserAvatar :user="a.data.value" size="xs" />
                      {{ getUser(a.data.value).full_name }}
                    </div>
                    <div v-else class="truncate">
                      {{ a.data.value }}
                    </div>
                  </span>
                </div>

                <div class="ml-auto whitespace-nowrap">
                  <Tooltip :text="formatDate(a.creation)">
                    <div class="text-sm text-ink-gray-5">
                      {{ __(timeAgo(a.creation)) }}
                    </div>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
    <div v-else-if="title == 'Data'" class="h-full flex flex-col px-3 pb-3 sm:px-10 sm:pb-5">
      <!-- TATVA: CRM Lead gets the clean grain/brain-aware panel; other doctypes keep native DataFields. -->
      <TatvaDetailPanel
        v-if="doctype === 'CRM Lead'"
        :doctype="doctype"
        :docname="docname"
      />
      <DataFields
        v-else
        :doctype="doctype"
        :docname="docname"
        @beforeSave="(data) => emit('beforeSave', data)"
        @afterSave="(data) => emit('afterSave', data)"
      />
    </div>
    <!-- TATVA: search/filter matched nothing (the tab has items, all hidden) — native centered state. -->
    <EmptyState
      v-else-if="noMatches"
      name="results"
      :title="__('No matches')"
      :description="__('No results match your search or filter.')"
      :icon="emptyTextIcon"
      :top="top"
    />
    <EmptyState
      v-else
      :title="emptyText"
      :description="emptyTextDescription"
      :icon="emptyTextIcon"
      :top="top"
    />
  </FadedScrollableDiv>
  <div>
    <CommunicationArea
      v-if="['Emails', 'Comments', 'Activity'].includes(title)"
      ref="emailBox"
      v-model="doc"
      v-model:reload="reload_email"
      :doctype="doctype"
      @scroll="scroll"
    />
    <WhatsAppBox
      v-if="title == 'WhatsApp'"
      ref="whatsappBox"
      v-model="doc"
      v-model:reply="replyMessage"
      v-model:whatsapp="whatsappMessages"
      :doctype="doctype"
      @scroll="scroll"
      @send-template="showWhatsappTemplates = true"
    />
  </div>
  <!-- TATVA: our grain-scoped Send-Template dialog is the ONLY template flow (crm selector unwired). -->
  <TatvaWhatsAppTemplate
    v-if="whatsappEnabled"
    v-model="showWhatsappTemplates"
    :doctype="doctype"
    :docname="docname"
    @sent="whatsappMessages.reload()"
  />
  <AllModals
    ref="modalRef"
    v-model="all_activities"
    :doctype="doctype"
    :doc="doc"
  />
  <FilesUploader
    v-model="showFilesUploader"
    :doctype="doctype"
    :docname="docname"
    @after="
      () => {
        all_activities.reload()
        changeTabTo('attachments')
      }
    "
  />
</template>
<script setup>
import ActivityHeader from '@/components/Activities/ActivityHeader.vue'
import EmailArea from '@/components/Activities/EmailArea.vue'
import CommentArea from '@/components/Activities/CommentArea.vue'
import CallArea from '@/components/Activities/CallArea.vue'
import NoteCard from '@/tatva/NoteCard.vue' // TATVA: unified activity-card shape for the Notes tab
import TaskArea from '@/components/Activities/TaskArea.vue'
import TatvaTasks from '@/tatva/TatvaTasks.vue' // TATVA: native config-driven task board
import AttachmentArea from '@/components/Activities/AttachmentArea.vue'
import DataFields from '@/components/Activities/DataFields.vue'
import TatvaDetailPanel from '@/tatva/DetailPanel.vue' // TATVA: clean grain/brain-aware Lead Details (replaces raw child-table grids)
import UserAvatar from '@/components/UserAvatar.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import WhatsAppArea from '@/components/Activities/WhatsAppArea.vue'
import WhatsAppBox from '@/components/Activities/WhatsAppBox.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import DotIcon from '@/components/Icons/DotIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import SelectIcon from '@/components/Icons/SelectIcon.vue'
import MissedCallIcon from '@/components/Icons/MissedCallIcon.vue'
import DeclinedCallIcon from '@/components/Icons/DeclinedCallIcon.vue'
import InboundCallIcon from '@/components/Icons/InboundCallIcon.vue'
import OutboundCallIcon from '@/components/Icons/OutboundCallIcon.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import CommunicationArea from '@/components/CommunicationArea.vue'
import TatvaWhatsAppTemplate from '@/tatva/TatvaWhatsAppTemplate.vue' // TATVA: sole Send-Template flow
import AllModals from '@/components/Activities/AllModals.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import { timeAgo, formatDate, startCase } from '@/utils'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { createDialog } from '@/utils/dialogs'
import {
  isWhatsAppRefreshing,
  refreshWhatsAppHistory,
  syncWhatsAppRefreshState,
} from '@/tatva/whatsappRefresh'
import { whatsappEnabled } from '@/composables/whatsapp'
import { useDocument } from '@/data/document'
import { useTelemetry } from 'frappe-ui/frappe'
import { Button, Tooltip, call, createResource, toast } from 'frappe-ui'
import { useElementVisibility } from '@vueuse/core'
import {
  ref,
  computed,
  h,
  markRaw,
  watch,
  watchEffect,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from 'vue'
import { useRoute } from 'vue-router'
// TATVA: clean per-lead audit row renderer for our synthetic activity entries.
import ActivityAuditEntry from '@/tatva/ActivityAuditEntry.vue'
// TATVA: shared search + Filter toolbar for the activity tabs (one mechanism, all tabs).
import {
  activityToolbar,
  resetActivityToolbar,
} from '@/tatva/activityToolbar.js'
import { passesFilter } from '@/tatva/activityMatch.js'

const { $socket } = globalStore()
const { getUser } = usersStore()
const { capture } = useTelemetry()

// TATVA: activity_types our server assembler injects — rendered by ActivityAuditEntry, and skipped
// by update_activities_details (they already carry owner_name/verb/subject/detail from the server).
const TATVA_AUDIT_TYPES = [
  'activity_logged',
  'stage_moved',
  'task_created',
  'task_closed',
  'lifecycle',
]

const props = defineProps({
  doctype: { type: String, default: 'CRM Lead' },
  docname: { type: String, default: '' },
  tabs: { type: Array, default: () => [] },
})

const emit = defineEmits(['beforeSave', 'afterSave'])

const route = useRoute()

const reload = defineModel('reload', { type: Boolean, default: false })
const tabIndex = defineModel('tabIndex', { type: Number, default: 0 })

const { document: _document } = useDocument(props.doctype, props.docname)

const doc = computed(() => _document.doc || {})

const reload_email = ref(false)
const modalRef = ref(null)
const showFilesUploader = ref(false)

const title = computed(() => props.tabs?.[tabIndex.value]?.name || 'Activity')

const changeTabTo = (tabName) => {
  const tabNames = props.tabs?.map((tab) => tab.name?.toLowerCase())
  const index = tabNames?.indexOf(tabName)
  if (index == -1) return
  tabIndex.value = index
}

const all_activities = createResource({
  url: 'crm.api.activities.get_activities',
  params: { name: props.docname },
  cache: ['activity', props.docname],
  auto: true,
  transform: ([versions, calls, notes, tasks, attachments]) => {
    return { versions, calls, notes, tasks, attachments }
  },
  onSuccess: () => nextTick(() => scroll()),
})

const showWhatsappTemplates = ref(false)

const whatsappMessages = createResource({
  url: 'crm.api.whatsapp.get_whatsapp_messages',
  cache: ['whatsapp_messages', props.docname],
  params: {
    reference_doctype: props.doctype,
    reference_name: props.docname,
  },
  auto: false,
  transform: (data) => sortByCreation(data),
  onSuccess: () => nextTick(() => scroll()),
})

// TATVA: WATI delivery-failure reasons (replaces the retired whatsapp_failed_reason.js DOM hack).
// {whatsapp_message_name: reason}; WhatsAppArea renders it as a native Tooltip on the failed Badge.
const failedReasons = createResource({
  url: 'tatva_connect.api.whatsapp.failed_reasons',
  params: {
    reference_doctype: props.doctype,
    reference_name: props.docname,
  },
  auto: false,
})

watch(
  whatsappEnabled,
  (enabled) => {
    if (enabled) {
      whatsappMessages.fetch()
      failedReasons.fetch()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  $socket.off('whatsapp_message')
})

onMounted(() => {
  $socket.on('whatsapp_message', (data) => {
    if (
      data.reference_doctype === props.doctype &&
      data.reference_name === props.docname
    ) {
      whatsappMessages.reload()
      failedReasons.reload() // TATVA: keep failure-reason tooltips current as the thread updates
    }
  })

  nextTick(() => {
    const hash = route.hash.slice(1) || null
    let tabNames = props.tabs?.map((tab) => tab.name)
    if (!tabNames?.includes(hash)) {
      scroll(hash)
    }
  })
})

// TATVA: Refresh History (WhatsApp split-button) — confirm, then hand to the queued job.
// The work is 5-15s against the provider, so it is enqueued and reported over realtime; all of that
// lives in @/tatva/whatsappRefresh, which owns the in-flight state and the completion toast so both
// survive the rep navigating away. Nothing here waits, and nothing here toasts.
const refreshingHistory = computed(() => isWhatsAppRefreshing(props.docname))

// A refresh started by ANYONE, before this tab opened the lead, must still show as blocked — so the
// server is asked on arrival and whenever the record changes. The realtime event keeps it current
// from then on.
watch(
  () => props.docname,
  (name) => name && syncWhatsAppRefreshState(props.doctype, name),
  { immediate: true },
)

function refreshHistory() {
  if (refreshingHistory.value) return
  createDialog({
    title: __('Refresh history'),
    message: __(
      'Fetch this conversation from the provider and add anything missing? Existing messages are kept.',
    ),
    actions: [
      {
        label: __('Refresh'),
        variant: 'solid',
        onClick: (close) => {
          close()
          refreshWhatsAppHistory(props.doctype, props.docname)
        },
      },
    ],
  })
}

const replyMessage = ref({})

function get_activities() {
  if (!all_activities.data?.versions) return []
  if (!all_activities.data?.calls.length)
    return all_activities.data.versions || []
  return [...all_activities.data.versions, ...all_activities.data.calls]
}

const activities = computed(() => {
  let _activities = []
  if (title.value == 'Activity') {
    _activities = get_activities()
  } else if (title.value == 'Emails') {
    if (!all_activities.data?.versions) return []
    _activities = all_activities.data.versions.filter(
      (activity) => activity.activity_type === 'communication',
    )
  } else if (title.value == 'Comments') {
    if (!all_activities.data?.versions) return []
    _activities = all_activities.data.versions.filter(
      (activity) => activity.activity_type === 'comment',
    )
  } else if (title.value == 'Calls') {
    if (!all_activities.data?.calls) return []
    return sortByCreation(all_activities.data.calls)
  } else if (title.value == 'Tasks') {
    if (!all_activities.data?.tasks) return []
    return sortByModified(all_activities.data.tasks)
  } else if (title.value == 'Notes') {
    if (!all_activities.data?.notes) return []
    return sortByModified(all_activities.data.notes)
  } else if (title.value == 'Attachments') {
    if (!all_activities.data?.attachments) return []
    return sortByModified(all_activities.data.attachments)
  }

  _activities.forEach((activity) => {
    activity.icon = timelineIcon(activity.activity_type, activity.is_lead)

    if (
      activity.activity_type == 'incoming_call' ||
      activity.activity_type == 'outgoing_call' ||
      activity.activity_type == 'communication' ||
      TATVA_AUDIT_TYPES.includes(activity.activity_type) // TATVA: synthetic rows carry their own fields
    )
      return

    update_activities_details(activity)

    if (activity.other_versions) {
      activity.show_others = false
      activity.other_versions.forEach((other_version) => {
        update_activities_details(other_version)
      })
    }
  })
  // TATVA: Activity tab shows newest → oldest, top to bottom (reverse of upstream's
  // oldest-first chat order). Only the Activity feed is flipped; Calls/Tasks/Notes unchanged.
  return sortByCreation(_activities).reverse()
})

// TATVA: per-tab filter catalogs published to the shared toolbar for the static activity tabs.
// (Lead Tasks publishes its own dynamic catalog from <TatvaTasks>.) Matched client-side against the
// already-loaded items, so each `fieldname` is the item's own property.
const CALL_STATUS_OPTIONS =
  'Completed\nNo Answer\nBusy\nFailed\nInitiated\nRinging\nIn Progress\nQueued\nCanceled'
const ACTIVITY_FILTERS = {
  Comments: [
    { fieldname: 'owner', fieldtype: 'Link', label: __('Created By'), options: 'User' },
  ],
  Notes: [{ fieldname: 'owner', fieldtype: 'Link', label: __('Created By'), options: 'User' }],
  Calls: [
    { fieldname: 'type', fieldtype: 'Select', label: __('Type'), options: 'Incoming\nOutgoing' },
    { fieldname: 'status', fieldtype: 'Select', label: __('Status'), options: CALL_STATUS_OPTIONS },
  ],
  Attachments: [
    { fieldname: 'file_type', fieldtype: 'Data', label: __('File Type') },
    { fieldname: 'is_private', fieldtype: 'Check', label: __('Private') },
  ],
}

// Searchable text per tab (free-text box); HTML stripped so rich content matches as plain text.
const stripTags = (s) => (s || '').replace(/<[^>]*>/g, ' ')
const ACTIVITY_SEARCH = {
  Comments: (a) => `${a.owner_name || ''} ${stripTags(a.content)}`,
  Notes: (a) => `${a.title || ''} ${stripTags(a.content)}`,
  Calls: (a) =>
    `${a._caller?.label || ''} ${a._receiver?.label || ''} ${a.type || ''} ${a.status || ''}`,
  Attachments: (a) => `${a.file_name || ''} ${a.file_type || ''}`,
  Tasks: (a) => `${a.title || ''} ${a.status || ''} ${a.priority || ''}`,
}

// Rendered list for the filterable tabs = activities passed through the header search + filter.
// Pure client-side over already-loaded data — no extra API call. (Lead Tasks filters in the board.)
const displayActivities = computed(() => {
  const list = activities.value || []
  const q = activityToolbar.search.trim().toLowerCase()
  const getText = ACTIVITY_SEARCH[title.value]
  return list.filter(
    (a) =>
      passesFilter(a, activityToolbar.predicate) &&
      (!q || !getText || getText(a).toLowerCase().includes(q)),
  )
})

// Whether the active tab carries the shared search + Filter toolbar.
const isFilterable = computed(() =>
  ['Comments', 'Notes', 'Calls', 'Tasks', 'Attachments'].includes(title.value),
)

// What the content block actually renders (filterable tabs render displayActivities). When this is
// empty the block is skipped, so search/filter that matches nothing falls through to a native
// EmptyState instead of a blank pane.
const hasVisibleContent = computed(() => {
  if (title.value === 'WhatsApp') return !!whatsappMessages.data?.length
  if (isFilterable.value) return displayActivities.value.length > 0
  return !!activities.value?.length
})

// The tab has items but the search/filter hid them all (vs. a genuinely empty tab).
const noMatches = computed(
  () =>
    isFilterable.value &&
    activities.value.length > 0 &&
    displayActivities.value.length === 0,
)

// Single owner of the toolbar across tab switches: clear search/filter, then publish the active tab's
// catalog. The lead Tasks board owns its own dynamic catalog, so leave fields empty for it here.
watch(
  title,
  (t) => {
    activityToolbar.search = ''
    activityToolbar.predicate = null
    activityToolbar.model = { data: {}, params: { filters: {} } }
    activityToolbar.hasData = false // until the active tab confirms it has items
    activityToolbar.fields =
      t === 'Tasks' && props.doctype === 'CRM Lead' ? [] : ACTIVITY_FILTERS[t] || []
  },
  { immediate: true },
)

// Show search + Filter only when the active filterable tab actually has items (UNFILTERED). The lead
// Tasks board owns this flag (its data lives in <TatvaTasks>, not `activities`); every other tab here.
watchEffect(() => {
  if (title.value === 'Tasks' && props.doctype === 'CRM Lead') return
  activityToolbar.hasData = isFilterable.value && (activities.value?.length || 0) > 0
})

onBeforeUnmount(() => resetActivityToolbar())

// TATVA: copy before sorting — these helpers must NOT mutate their input. The Activity
// feed can pass the reactive `all_activities.data.versions` array here (get_activities
// returns it by reference when there are no calls); an in-place sort()+reverse() inside the
// `activities` computed mutates that reactive array, never converges, and hard-freezes the
// page. A pure sort (copy-first) closes this across every tab branch.
function sortByCreation(list) {
  return [...list].sort((a, b) => new Date(a.creation) - new Date(b.creation))
}
function sortByModified(list) {
  return [...list].sort((b, a) => new Date(a.modified) - new Date(b.modified))
}

function update_activities_details(activity) {
  activity.owner_name = getUser(activity.owner).full_name
  activity.type = ''
  activity.value = ''
  activity.to = ''

  if (activity.activity_type == 'creation') {
    activity.type = activity.data
  } else if (activity.activity_type == 'added') {
    activity.type = 'added'
    activity.value = 'as'
  } else if (activity.activity_type == 'removed') {
    activity.type = 'removed'
    activity.value = 'value'
  } else if (activity.activity_type == 'changed') {
    activity.type = 'changed'
    activity.value = 'from'
    activity.to = 'to'
  }
}

const top = computed(() => {
  if (['Activity', 'Emails', 'Comments'].includes(title.value)) {
    return '32.3%'
  }
  return '30%'
})

const emptyText = computed(() => {
  let text = 'No Activities Found'
  if (title.value == 'Emails') {
    text = 'No Emails Found'
  } else if (title.value == 'Comments') {
    text = 'No Comments Found'
  } else if (title.value == 'Data') {
    text = 'No Data Fields Added Yet'
  } else if (title.value == 'Calls') {
    text = 'No Call History'
  } else if (title.value == 'Notes') {
    text = 'No Notes Found'
  } else if (title.value == 'Tasks') {
    text = 'No Tasks Found'
  } else if (title.value == 'Attachments') {
    text = 'No Attachments Found'
  } else if (title.value == 'WhatsApp') {
    text = 'No WhatsApp Messages Found'
  }
  return text
})

const emptyTextDescription = computed(() => {
  let description =
    'There are no activities to display here. Go ahead and make some changes.'
  if (title.value == 'Emails') {
    description =
      'No emails found in your inbox. New messages will appear here soon.'
  } else if (title.value == 'Comments') {
    description = 'Be the first to add one.'
  } else if (title.value == 'Data') {
    description = 'No data fields have been added yet.'
  } else if (title.value == 'Calls') {
    description = 'No recent calls to display. Log a call or call someone now!'
  } else if (title.value == 'Notes') {
    description = 'Nothing here for now. Add a note to keep track of things.'
  } else if (title.value == 'Tasks') {
    description =
      'Nothing to do at the moment. Start organizing by adding one here.'
  } else if (title.value == 'Attachments') {
    description =
      'No files have been attached yet. Upload files to see them here.'
  } else if (title.value == 'WhatsApp') {
    description = 'Start a conversation now!'
  }
  return description
})

const emptyTextIcon = computed(() => {
  let icon = ActivityIcon
  if (title.value == 'Emails') {
    icon = EmailIcon
  } else if (title.value == 'Comments') {
    icon = CommentIcon
  } else if (title.value == 'Data') {
    icon = DetailsIcon
  } else if (title.value == 'Calls') {
    icon = PhoneIcon
  } else if (title.value == 'Notes') {
    icon = NoteIcon
  } else if (title.value == 'Tasks') {
    icon = TaskIcon
  } else if (title.value == 'Attachments') {
    icon = AttachmentIcon
  } else if (title.value == 'WhatsApp') {
    icon = WhatsAppIcon
  }
  return h(icon, { class: 'text-ink-gray-4' })
})

function timelineIcon(activity_type, is_lead) {
  let icon
  switch (activity_type) {
    case 'creation':
      icon = is_lead ? LeadsIcon : DealsIcon
      break
    case 'deal':
      icon = DealsIcon
      break
    case 'comment':
      icon = CommentIcon
      break
    case 'incoming_call':
      icon = InboundCallIcon
      break
    case 'outgoing_call':
      icon = OutboundCallIcon
      break
    case 'attachment_log':
      icon = AttachmentIcon
      break
    default:
      icon = DotIcon
  }

  return markRaw(icon)
}

const emailBox = ref(null)
const whatsappBox = ref(null)

watch([reload, reload_email], ([reload_value, reload_email_value]) => {
  if (reload_value || reload_email_value) {
    all_activities.reload()
    _document.reload()
    reload.value = false
    reload_email.value = false
  }
})

function scroll(hash) {
  // TATVA: the activity feeds (Activity/Emails/Comments) are newest-first and the card tabs start at
  // the top — auto-scrolling to the last (oldest) element jumps the view down into history, negating
  // the inversion. Only the WhatsApp chat (oldest-first) auto-scrolls to the bottom. A hash (deep-link
  // to a specific entry) still scrolls to that exact element on any tab.
  if (!hash && title.value !== 'WhatsApp') return
  if (['tasks', 'notes'].includes(route.hash?.slice(1))) return
  setTimeout(() => {
    let el
    if (!hash) {
      let e = document.getElementsByClassName('activity')
      el = e[e.length - 1]
    } else {
      el = document.getElementById(hash)
    }
    if (el && !useElementVisibility(el).value) {
      el.scrollIntoView({ behavior: 'smooth' })
      el.focus()
    }
  }, 500)
}

defineExpose({ emailBox, all_activities, changeTabTo })
</script>
