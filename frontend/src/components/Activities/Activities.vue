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
    :has-composer="hasComposer"
    :modalRef="modalRef"
    :refreshing-history="refreshingHistory"
    @refresh-history="refreshHistory"
  />
  <FadedScrollableDiv class="flex flex-col h-full overflow-y-auto">
    <div
      v-if="isLoading"
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
      <TatvaTasks
        :lead="doc?.name"
        :tasks="pagedItems"
        :loading="tabPage.loading && !tabPage.data"
        @changed="refreshTab()"
      />
    </div>
    <!-- TATVA: workflow history — ALWAYS mounted for a lead's Workflow tab, so "no journey yet" is
         answered by the panel itself rather than by the generic empty state. Fetches its own data. -->
    <div
      v-else-if="title === 'Workflow' && doctype === 'CRM Lead'"
      class="flex flex-1 flex-col"
    >
      <WorkflowHistory :doctype="doctype" :docname="docname" />
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
      <!-- TATVA: Notes render through the shared ActivityCard (U9). Card is dumb — it emits; we open/delete. -->
      <div v-else-if="title == 'Notes'" class="flex flex-col gap-2 px-3 pb-5 sm:px-10">
        <ActivityCard
          v-for="note in pagedItems"
          :key="note.name"
          v-bind="noteCard(note)"
          @open="modalRef.showNote(note)"
          @action="(k) => k === 'delete' && deleteNote(note.name)"
        />
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
              @reload="refreshTab()"
            />
          </div>
        </div>
      </div>
      <div v-else-if="title == 'Tasks'" class="px-3 pb-3 sm:px-10 sm:pb-5">
        <!-- TATVA: leads use the always-mounted board above; deals/other doctypes use native TaskArea. -->
        <TaskArea :modalRef="modalRef" :tasks="pagedItems" :doctype="doctype" />
      </div>
      <!-- TATVA: Calls render as a plain card list through CallArea's shared ActivityCard (U9). -->
      <div v-else-if="title == 'Calls'" class="flex flex-col gap-2 px-3 pb-5 sm:px-10">
        <CallArea
          v-for="callLog in pagedItems"
          :key="callLog.name"
          :activity="callLog"
        />
      </div>
      <div
        v-else-if="title == 'Attachments'"
        class="px-3 pb-3 sm:px-10 sm:pb-5"
      >
        <AttachmentArea
          :attachments="pagedItems"
          @reload="refreshTab() && scroll()"
        />
      </div>
      <!-- TATVA: the Activity tab is the merged RAIL — full cards (calls/notes/tasks/attachments) + the pure
           events, newest-first, stitched from the SAME get_activities payload (a computed, no new call). -->
      <div v-else-if="title == 'Activity'" class="flex flex-col pb-5 pt-2">
        <ActivityTimelineItem
          v-for="(item, i) in railItems"
          :key="item.key"
          :icon="item.icon"
          :actor="item.actor"
          :verb="item.verb"
          :at="item.at"
          :bare="item.bare"
          :last="i === railItems.length - 1"
        >
          <CallArea
            v-if="item.kind === 'call'"
            :activity="item.event"
            :show-type-icon="false"
          />
          <ActivityCard
            v-else-if="item.cardProps"
            :show-type-icon="false"
            v-bind="item.cardProps"
            @open="item.onOpen && item.onOpen()"
          />
          <CommentArea
            v-else-if="item.kind === 'comment'"
            :activity="item.event"
            in-rail
            @reload="refreshTab()"
          />
          <EmailArea
            v-else-if="item.kind === 'communication'"
            :activity="item.event"
            in-rail
          />
        </ActivityTimelineItem>
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
              @reload="refreshTab()"
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
  <!-- TATVA: the app's own list footer (page size · Load More · "N of M"), OUTSIDE the scroller and pinned,
       exactly as every list view mounts it. Bound to the SERVER's counts, and Load More refetches a bigger
       page — the Leads list contract (Leads.vue:238, ViewControls.vue:1058). -->
  <ListFooter
    v-if="footerTotal > 0"
    v-model="footerSize"
    class="shrink-0 border-t bg-surface-white px-3 py-3 sm:px-10"
    :options="{ rowCount: footerRows, totalCount: footerTotal }"
    @loadMore="onLoadMore"
  />
  <div>
    <CommunicationArea
      v-if="hasComposer"
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
    :refresh="refreshTab"
    :doctype="doctype"
    :doc="doc"
  />
  <FilesUploader
    v-model="showFilesUploader"
    :doctype="doctype"
    :docname="docname"
    @after="
      () => {
        refreshKind('attachment')
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
import ActivityCard from '@/tatva/ActivityCard.vue' // TATVA: the shared activity-card shape (U9)
import ActivityTimelineItem from '@/tatva/ActivityTimelineItem.vue' // TATVA: the Activity-tab rail node
import { oneLine, actorFor, fileCard } from '@/tatva/activityCard.js'
import TaskArea from '@/components/Activities/TaskArea.vue'
import TatvaTasks from '@/tatva/TatvaTasks.vue' // TATVA: native config-driven task board
import WorkflowHistory from '@/tatva/workflows/WorkflowHistory.vue' // TATVA: a lead's workflow journey history
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
import { timeAgo, formatDate, startCase, taskStatusList } from '@/utils'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { createDialog } from '@/utils/dialogs'
import {
  isWhatsAppRefreshing,
  refreshWhatsAppHistory,
  syncWhatsAppRefreshState,
  unwatchWhatsAppRefresh,
  watchWhatsAppRefresh,
} from '@/tatva/whatsappRefresh'
import { whatsappEnabled } from '@/composables/whatsapp'
import { useDocument } from '@/data/document'
import { Button, ListFooter, Tooltip, call, createResource, getCachedResource, toast } from 'frappe-ui'
import { useElementVisibility } from '@vueuse/core'
import {
  ref,
  reactive,
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
import { statusTheme } from '@/tatva/taskStatus.js' // TATVA: the ONE task-status → badge-theme map (rail task cards)
import { dueBadge } from '@/tatva/taskDue.js' // TATVA: the ONE due-state pill, so rail and board read alike

const { $socket } = globalStore()
const { getUser } = usersStore()

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

// TATVA: which tabs carry the composer — declared ONCE, obeyed by the mount below and the header's New menu; the Activity tab is a read-only rail.
const hasComposer = computed(() => ['Emails', 'Comments'].includes(title.value))


const changeTabTo = (tabName) => {
  const tabNames = props.tabs?.map((tab) => tab.name?.toLowerCase())
  const index = tabNames?.indexOf(tabName)
  if (index == -1) return
  tabIndex.value = index
}

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

function onWhatsAppMessage(data) {
  if (
    data.reference_doctype === props.doctype &&
    data.reference_name === props.docname
  ) {
    whatsappMessages.reload()
    failedReasons.reload() // TATVA: keep failure-reason tooltips current as the thread updates
  }
}

onBeforeUnmount(() => {
  // TATVA: remove OUR handler, not every handler for the event. The bare form unbinds all of them, so
  // the day a second surface listens for whatsapp_message, unmounting a lead would silently kill it.
  $socket.off('whatsapp_message', onWhatsAppMessage)
})

onMounted(() => {
  $socket.on('whatsapp_message', onWhatsAppMessage)

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
  (name, previous) => {
    if (previous) unwatchWhatsAppRefresh(props.doctype, previous)
    if (!name) return
    // Join the record's realtime room. Socketio admits us only if we may READ the record, so refresh
    // events never reach a rep who cannot see the lead.
    watchWhatsAppRefresh(props.doctype, name)
  },
  { immediate: true },
)

// A2: only the WhatsApp tab READS this state, so only it asks. reka unmounts a hidden panel, so this
// component remounts on every tab switch — and every tab was probing the server for a WhatsApp job.
watch(
  () => title.value === 'WhatsApp',
  (open) => open && syncWhatsAppRefreshState(props.doctype, props.docname),
  { immediate: true },
)

onBeforeUnmount(() => unwatchWhatsAppRefresh(props.doctype, props.docname))

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

const activities = computed(() => {
  // A card tab's rows are already ordered, filtered and limited by the server — nothing left to do here.
  if (!FEED_KINDS.includes(pageKind.value)) return pagedItems.value
  const _activities = pagedItems.value

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

// TATVA: the ONE per-tab filter catalog, Tasks included — a second publisher in a child is how the board once offered a status its own filter could not select.
// A function, not a const: `taskStatusList()` reads doctype meta, which is not loaded when this module is imported.
const CALL_STATUS_OPTIONS =
  'Completed\nNo Answer\nBusy\nFailed\nInitiated\nRinging\nIn Progress\nQueued\nCanceled'
function activityFilters(tab) {
  return (
    {
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
      // Both narrow on COLUMNS, so the server answers them like every other tab. Due state is deliberately not here: it derives from due_date + status, and a filter would mean writing `dueBucket` again in SQL.
      Tasks: [
        { fieldname: 'status', fieldtype: 'Select', label: __('Status'), options: taskStatusList().join('\n') },
        { fieldname: 'custom_task_type', fieldtype: 'Link', label: __('Task Type'), options: 'CRM Task Type' },
      ],
    }[tab] || []
  )
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
  // A paged tab was narrowed by the SERVER, which is the only place that can see past the current page.
  // Re-filtering here would hide rows that already matched, and would make "of 103" a lie.
  if (isPaged.value) return list
  const q = activityToolbar.search.trim().toLowerCase()
  const getText = ACTIVITY_SEARCH[title.value]
  return list.filter(
    (a) =>
      passesFilter(a, activityToolbar.predicate) &&
      (!q || !getText || getText(a).toLowerCase().includes(q)),
  )
})

// A FCRM Note → the four-slot card shape. Title falls back to the first line of content; content is the
// flavor line. An attachment count becomes an icon-only CORNER indicator.
function noteCard(note) {
  const body = oneLine(note.content)
  const who = getUser(note.owner)
  return {
    tile: { kind: 'icon', icon: markRaw(NoteIcon), tint: 'green' },
    title: note.title || body || __('Untitled note'),
    flavor: note.title ? body : '',
    corner: note.attachments ? [{ icon: 'paperclip', tooltip: __('{0} attachment(s)', [note.attachments]) }] : [],
    actor: actorFor(note.automation, { label: who.full_name, image: who.user_image }),
    at: note.modified,
    menu: [{ label: __('Delete'), icon: 'trash-2', key: 'delete' }],
  }
}

async function deleteNote(name) {
  await toast.promise(call('frappe.client.delete', { doctype: 'FCRM Note', name }), {
    loading: __('Deleting note...'),
    success: __('Note deleted'),
    error: __('Failed to delete note'),
  })
  refreshTab()
}

// TATVA: the Activity RAIL — a client-side merge of the SAME get_activities payload (U4: a computed, never
// a new call). Calls/notes/tasks/attachments render as full cards; the PURE events (stage moves, field
// changes, comments, emails, lead creation) ride alongside them, newest-first. The redundant one-liners
// the rich cards replace (task_created / attachment_log / activity_logged / task_closed / lifecycle) are
// dropped here so nothing double-counts. Keys are stable `type:name` so a reload diff-patches, never
// full-remounts (click isolation). The rail is read-only — card overflow menus are stripped.
function railNote(n) {
  const who = getUser(n.owner)
  const { menu, ...card } = noteCard(n)
  return {
    key: `note:${n.name}`, kind: 'note', icon: markRaw(NoteIcon),
    actor: actorFor(n.automation, { label: who.full_name, image: who.user_image }),
    verb: __('added a note'), at: n.modified, cardProps: card,
    onOpen: () => modalRef.value?.showNote(n),
  }
}

function railTask(t) {
  const done = t.status === 'Done' || t.status === 'Canceled'
  // TATVA: the task rail carries assigned_to, never owner — and getUser() falls back to the SESSION
  // user for an empty email, so every migrated task was labelled with whoever happened to be reading
  // the screen. assigned_to is the same person the task modal already names as Assignee.
  const who = getUser(t.assigned_to)
  return {
    key: `task:${t.name}`, kind: 'task', icon: markRaw(TaskIcon),
    actor: actorFor(t.automation, { label: who.full_name, image: who.user_image }),
    verb: __('logged a task'), at: t.creation,
    cardProps: {
      title: t.title,
      badge: done ? { label: t.status, theme: statusTheme(t.status) } : dueBadge(t),
      flavor: [t.due, t.priority].filter(Boolean).join(' · '),
      dimmed: done,
    },
    onOpen: () => modalRef.value?.showTask({ name: t.name }),
  }
}

function railCall(c) {
  const incoming = c.type === 'Incoming'
  const handler = incoming ? c._receiver?.label : c._caller?.label
  return {
    key: `call:${c.name}`, kind: 'call', icon: markRaw(incoming ? InboundCallIcon : OutboundCallIcon),
    actor: { label: handler || '', image: (incoming ? c._receiver?.image : c._caller?.image) || '' },
    verb: incoming ? __('received a call') : __('made a call'), at: c.creation, event: c,
  }
}

function railAttachment(f) {
  const who = getUser(f.owner)
  const { menu, ...card } = fileCard(f, getUser)
  return {
    key: `attachment:${f.name}`, kind: 'attachment', icon: markRaw(AttachmentIcon),
    actor: { label: who.full_name, image: who.user_image },
    verb: __('attached a file'), at: f.creation, cardProps: card,
    onOpen: () => window.open(f.file_url, '_blank'),
  }
}

// A pure event → a rail node. Comment/email render their own header (bare); everything else carries the
// detail in the header verb (no body). Owner is resolved fresh (pure — no mutation of the payload, U5).
function railEvent(a) {
  const at = a.creation
  if (a.activity_type === 'comment') {
    const who = getUser(a.owner)
    return { key: `comment:${a.name}`, kind: 'comment', icon: markRaw(CommentIcon), at,
      actor: { label: a.owner_name || who.full_name || a.owner, image: who.user_image },
      verb: __('added a comment'),
      event: { ...a, owner_name: who.full_name } }
  }
  if (a.activity_type === 'communication') {
    return { key: `comm:${a.name}`, kind: 'communication', icon: markRaw(EmailIcon), bare: true, at, event: a }
  }
  const who = getUser(a.owner)
  const actor = { label: a.owner_name || who.full_name || a.owner, image: who.user_image }
  if (a.activity_type === 'stage_moved') {
    return { key: `stage:${a.creation}`, kind: 'event', icon: markRaw(DotIcon), actor,
      verb: __('moved stage {0} → {1}', [a.from_stage || '—', a.to_stage || '—']), at }
  }
  if (a.activity_type === 'creation') {
    return { key: `creation:${a.name || a.creation}`, kind: 'event',
      icon: markRaw(a.is_lead ? LeadsIcon : DealsIcon), actor,
      verb: __('created this {0}', [a.is_lead ? __('lead') : __('deal')]), at }
  }
  const field = a.data?.field_label ? __(a.data.field_label) : ''
  const verb = a.activity_type === 'changed' ? __('changed {0}', [field])
    : a.activity_type === 'added' ? __('set {0}', [field])
    : __('cleared {0}', [field])
  return { key: `field:${a.name || a.creation}`, kind: 'event', icon: markRaw(DotIcon), actor, verb, at }
}

// The rail is a MAPPER over one already-ordered, already-paged stream — the server merges and tags each row's `kind`, and this turns that kind into the adapter that draws it.
const RAIL_ADAPTERS = {
  call: railCall,
  note: railNote,
  task: railTask,
  file: railAttachment,
}
const railItems = computed(() =>
  pagedItems.value
    .map((row) => (RAIL_ADAPTERS[row.kind] || railEvent)(row))
    .filter(Boolean),
)

// TATVA: the card tabs page on the SERVER, on the Leads list contract — same params, same envelope, and a Load More that refetches 0..N with a bigger page_length (ViewControls.vue:1058). No cursor, no append.
// The footer's [20][50][100] step; the current limit lives on tabPage.params, as the Leads page has it.
const PAGE_LENGTH = 20
const pageSize = ref(PAGE_LENGTH)

// Which server `kind` this tab reads; Data/Workflow render their own panels. Tasks reads `task` like every other tab — the lead board is a RENDERER over these rows, not a second data path.
const TAB_KIND = {
  Activity: 'all',
  Calls: 'call',
  Notes: 'note',
  Attachments: 'attachment',
  Comments: 'comment',
  Emails: 'email',
  Tasks: 'task',
}

// These two render through the STOCK feed, which reads display fields the enrichment adds; every other paged tab uses ActivityCard and needs none of it.
const FEED_KINDS = ['comment', 'email']
const pageKind = computed(() => TAB_KIND[title.value] || '')
const isPaged = computed(() => !!pageKind.value)

// The Filter button's dict, passed to the server untouched — the shape frappe.get_list takes (ViewControls.vue:490).
const serverFilters = computed(() => activityToolbar.model?.params?.filters || {})

// Paging state lives ON THE RESOURCE, as ViewControls.vue:1057 does — two panels share this cached resource mid-switch, so a per-instance ref sent the loser's stale page_length.
// The query we own and hand to every fetch — frappe-ui fills its own `params` only inside fetch(), so reading it back before one has run is a null.
const query = reactive({
  lead: props.docname,
  doctype: props.doctype,
  kind: pageKind.value,
  page_length: PAGE_LENGTH,
  page_length_count: PAGE_LENGTH,
  order_by: 'creation desc',
  filters: '{}',
  search: '',
})

const tabPage = createResource({
  url: 'tatva_connect.api.activities.lead_activity',
  cache: ['lead-activity', props.docname, pageKind.value],
  params: query,
})

// A remount gets a FRESH query but the CACHED resource, so Load More's grown page_length survived only on the resource — read it back, or the next refresh-after-write silently collapses 40 rows to 20.
Object.assign(query, {
  page_length: tabPage.params?.page_length || PAGE_LENGTH,
  page_length_count: tabPage.params?.page_length_count || PAGE_LENGTH,
})

// Every narrowing restarts at page one, so page_length is never left where Load More had got to.
function askAgain(changes = {}) {
  Object.assign(query, {
    page_length: query.page_length_count,
    order_by: activityToolbar.orderBy,
    filters: JSON.stringify(serverFilters.value),
    search: activityToolbar.search || '',
    ...changes,
  })
  tabPage.reload({ ...query })
}

// Only when there is nothing to paint — a cached tab is already on screen, and refetching it is the flash.
// `!loading` too: the outgoing and incoming panels co-exist for a tick and each fired the same request.
if (isPaged.value && !tabPage.data && !tabPage.loading) tabPage.fetch({ ...query })

const pagedItems = computed(() => tabPage.data?.data || [])
const rowCount = computed(() => tabPage.data?.row_count || 0)
const totalCount = computed(() => tabPage.data?.total_count || 0)

function loadMore() {
  // ViewControls.vue:1052 opens with the same guard — a double-tap otherwise races two pages and the
  // smaller response can land last.
  if (tabPage.loading) return
  query.page_length += query.page_length_count
  tabPage.reload({ ...query })
}

// ONE refresh-after-write; callers say "this changed" without knowing which supplier is behind the tab.
function refreshTab() {
  if (isPaged.value) tabPage.reload({ ...query })
  return true
}

// A write can land on a tab that is NOT the one in front of us — an upload jumps to Attachments, whose
// resource is cached and whose mount guard would then skip its fetch and show a stale page.
function refreshKind(kind) {
  getCachedResource(['lead-activity', props.docname, kind])?.reload()
}

// A new page size restarts the list at that size — it is not "show me 50 more".
watch(pageSize, (n) => {
  if (!isPaged.value) return
  askAgain({ page_length_count: n, page_length: n })
})

// ONE pinned footer for every tab, answered by the one resource behind them all.
const footerRows = computed(() => rowCount.value)
const footerTotal = computed(() => (isPaged.value ? totalCount.value : 0))
const footerSize = computed({
  get: () => pageSize.value,
  set: (n) => (pageSize.value = n),
})

function onLoadMore() {
  loadMore()
}

// `loading && !data` — the house gate (TatvaTasks.vue:8); gating on `loading` alone throws the cache away.
const isLoading = computed(() => tabPage.loading && !tabPage.data)

// A new page size, a new sort, a new search or a new filter is a new question — ask it from the first
// page, never from wherever Load More had got to.
// Watched by VALUE, not identity — the toolbar hands out a fresh `{}` per tab settle and fired a duplicate.
watch(
  [
    () => activityToolbar.orderBy,
    () => JSON.stringify(serverFilters.value),
    () => activityToolbar.search,
  ],
  () => {
    if (isPaged.value) askAgain()
  },
)

// Whether the active tab carries the shared search + Filter toolbar.
const isFilterable = computed(() =>
  ['Comments', 'Notes', 'Calls', 'Tasks', 'Attachments'].includes(title.value),
)

// What the content block actually renders (filterable tabs render displayActivities). When this is
// empty the block is skipped, so search/filter that matches nothing falls through to a native
// EmptyState instead of a blank pane.
const hasVisibleContent = computed(() => {
  if (title.value === 'WhatsApp') return !!whatsappMessages.data?.length
  if (title.value === 'Activity') return railItems.value.length > 0 // TATVA: the merged rail feeds this tab
  if (isPaged.value) return rowCount.value > 0
  if (isFilterable.value) return displayActivities.value.length > 0
  return !!activities.value?.length
})

// The tab has items but the search/filter hid them all (vs. a genuinely empty tab).
const noMatches = computed(() => {
  // On a paged tab the server answered the narrowed question, so an empty page WITH a search or filter
  // in force is "nothing matched" — there is no unfiltered list on the client to compare against.
  if (isPaged.value)
    return (
      totalCount.value === 0 &&
      (!!activityToolbar.search || !!Object.keys(serverFilters.value).length)
    )
  return (
    isFilterable.value &&
    activities.value.length > 0 &&
    displayActivities.value.length === 0
  )
})

// ONE instance per tab (Tabs unmounts the inactive panel), so the mounted one owns the toolbar for its whole life and publishes it once, here — a new tab is a new question, so it starts clean.
// Nothing clears it on the way out: the two panels overlap for a tick and a dying panel's reset wiped what the new one had just published, which is why the controls vanished moving LEFT and not right.
resetActivityToolbar()
activityToolbar.fields = activityFilters(title.value)

// Search + Filter show only when the tab has items UNFILTERED, so they do not vanish the moment a search empties the page and strand the rep with no way to clear it.
watchEffect(() => {
  activityToolbar.hasData = isPaged.value
    ? totalCount.value > 0 ||
      !!activityToolbar.search ||
      !!Object.keys(serverFilters.value).length
    : isFilterable.value && (activities.value?.length || 0) > 0
})

// TATVA: copy before sorting — an in-place sort()+reverse() on a resource's own reactive array never converges and hard-freezes the page.
function sortByCreation(list) {
  return [...list].sort((a, b) => new Date(a.creation) - new Date(b.creation))
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
    refreshTab()
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

defineExpose({ emailBox, changeTabTo, refreshTab, refreshKind })
</script>
