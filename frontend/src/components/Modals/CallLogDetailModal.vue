<!-- eslint-disable vue/no-v-html -->
<template>
  <!-- `options.title` is what the MOBILE sheet draws in its own sticky header; on desktop this component
       draws the header itself, so it changes nothing there. Left static it said "Call Details" for an AI
       call on a phone and the badge never appeared — the sheet is the one surface that owns its title. -->
  <ResponsiveDialog
    v-model="show"
    :options="{ title: headerTitle, size: hasMediaPanel ? '4xl' : 'lg' }"
  >
    <template #body-main>
      <!-- THE SURFACE BELONGS TO WHICHEVER SHELL IS DRAWING. `bg-surface-modal` is the DESKTOP dialog's
           surface; the mobile sheet paints its own `bg-surface-white`, and in dark mode those are two
           different colours (#232323 against #0F0F0F), so imposing this one inside a sheet made the body
           a lighter slab than the sticky header and footer around it — and flattened the grey cards
           (#2B2B2B) against it. On the sheet the body states no surface and the sheet's own shows
           through; on the dialog nothing changes. -->
      <div
        :class="[
          'px-4 pb-6 pt-5 sm:px-6',
          isMobileView ? '' : 'bg-surface-modal',
        ]"
      >
        <!-- The row survives on mobile for the note/task menu; the title and close X are desktop chrome (the sheet draws both). -->
        <div class="mb-5 flex items-start justify-between gap-3">
          <!-- TATVA: the title is data-driven, never forked per medium — an Acefone call draws the SAME header with no sparkle and no badge. The provider name is diagnostic and lives in the subtitle; a rep reads the badge, not the vendor. -->
          <div v-if="!isMobileView" class="min-w-0">
            <h3
              class="flex items-center gap-2 text-2xl font-semibold leading-7 text-ink-gray-9"
            >
              <SparkleIcon v-if="isAiVoice" class="size-5 shrink-0" />
              <span class="truncate">{{ headerTitle }}</span>
              <Badge v-if="isAiVoice" theme="blue" variant="subtle" :label="__('AI Voice')" />
            </h3>
            <p v-if="headerSubtitle" class="mt-0.5 truncate text-p-sm text-ink-gray-5">
              {{ headerSubtitle }}
            </p>
          </div>
          <!-- H2: content yields, controls do not — the title truncates and these stay put. -->
          <div class="ml-auto flex shrink-0 items-center gap-1">
            <Dropdown
              :options="[
                {
                  group: __('Options'),
                  hideLabel: true,
                  items: [
                    {
                      label: note ? __('Edit Note') : __('Add Note'),
                      icon: NoteIcon,
                      onClick: () => showNote(note),
                    },
                    {
                      label: task ? __('Edit Task') : __('Add Task'),
                      icon: TaskIcon,
                      onClick: () => showTask(task),
                    },
                  ],
                },
              ]"
            >
              <template #default>
                <Button variant="ghost" icon="more-horizontal" />
              </template>
            </Dropdown>
            <Button
              v-if="!isMobileView"
              variant="ghost"
              :tooltip="__('Edit Call Log')"
              :icon="EditIcon"
              class="w-7"
              @click="openCallLogModal"
            />
            <Button
              v-if="!isMobileView"
              icon="x"
              variant="ghost"
              class="w-7"
              @click="show = false"
            />
          </div>
        </div>
      <!-- H1: the media cluster is a SIBLING of the details, never inside them, so the muted detail
           lines can never run underneath it. H4: a responsive fraction, so the panel is a fraction only
           where there is room for one — on mobile the grid collapses and the panel comes FIRST. -->
      <div class="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-12">
        <div
          :class="[
            'flex flex-col gap-3.5',
            hasMediaPanel ? 'order-2 sm:order-1 sm:col-span-5' : 'sm:col-span-12',
          ]"
        >
          <div
            v-for="field in detailFields"
            :key="field.name"
            class="flex gap-2 text-base text-ink-gray-8"
          >
            <div class="grid size-7 place-content-center">
              <component :is="field.icon" />
            </div>
            <div class="flex min-h-7 w-full items-center gap-2">
              <div
                v-if="field.name == 'receiver'"
                class="flex items-center gap-1"
              >
                <Avatar
                  :image="field.value.caller.image"
                  :label="field.value.caller.label"
                  size="sm"
                />
                <div class="ml-1 flex flex-col gap-1">
                  {{ field.value.caller.label }}
                </div>
                <FeatherIcon
                  name="arrow-right"
                  class="mx-1 h-4 w-4 text-ink-gray-5"
                />
                <Avatar
                  :image="field.value.receiver.image"
                  :label="field.value.receiver.label"
                  size="sm"
                />
                <div class="ml-1 flex flex-col gap-1">
                  {{ field.value.receiver.label }}
                </div>
              </div>
              <Tooltip v-else-if="field.tooltip" :text="field.tooltip">
                {{ field.value }}
              </Tooltip>
              <div
                v-else-if="field.name == 'note'"
                class="w-full cursor-pointer rounded border px-2 pt-1.5 text-base text-ink-gray-7"
                @click="() => showNote(field.value?.name)"
              >
                <FadedScrollableDiv class="max-h-24 min-h-16 overflow-y-auto">
                  <div
                    v-if="field.value?.title"
                    :class="[field.value?.content ? 'mb-1 font-bold' : '']"
                    v-html="sanitizeHTML(field.value?.title)"
                  />
                  <div
                    v-if="field.value?.content"
                    v-html="sanitizeHTML(field.value?.content)"
                  />
                </FadedScrollableDiv>
              </div>
              <div
                v-else-if="field.name == 'task'"
                class="w-full cursor-pointer rounded border px-2 pt-1.5 text-base text-ink-gray-7"
                @click="() => showTask(field.value?.name)"
              >
                <FadedScrollableDiv class="max-h-24 min-h-16 overflow-y-auto">
                  <div
                    v-if="field.value?.title"
                    :class="[field.value?.description ? 'mb-1 font-bold' : '']"
                    v-html="sanitizeHTML(field.value?.title)"
                  />
                  <div
                    v-if="field.value?.description"
                    v-html="sanitizeHTML(field.value?.description)"
                  />
                </FadedScrollableDiv>
              </div>
              <!-- TATVA: this was `text-${field.color}-600`. Tailwind v4's JIT scanner cannot see an
                   interpolated class, so no status colour has EVER rendered here. `statusColorMap`'s five
                   values are exactly Badge's five themes, so the component answers it — theme-aware in
                   light and dark by construction, with no colour class of ours to keep in step. -->
              <Badge
                v-else-if="field.color"
                :theme="field.color"
                variant="subtle"
                :label="field.value"
              />
              <div v-else>
                {{ field.value }}
              </div>
              <div v-if="field.link">
                <ArrowUpRightIcon
                  class="h-4 w-4 shrink-0 cursor-pointer text-ink-gray-5 hover:text-ink-gray-8"
                  @click="() => field.link()"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- THE MEDIA PANEL. Every block below is keyed on what the call HAS, never on which provider
             carried it — an Acefone call opens this same modal with fewer blocks, which is the design. -->
        <div
          v-if="hasMediaPanel"
          class="order-1 flex min-w-0 flex-col gap-4 sm:order-2 sm:col-span-7"
        >
          <!-- ONE <audio>, pointed at OUR bytes through the proxy. Playback is stored-or-nothing: with
               no source there is no player, and no producer URL is ever put in its place. -->
          <audio
            v-if="playableSrc"
            ref="player"
            class="audio-control w-full"
            controls
            preload="none"
            :style="{ colorScheme: theme === 'dark' ? 'dark' : 'light' }"
            :src="playableSrc"
          ></audio>

          <div
            v-if="media?.data?.transcript?.summary"
            class="rounded-lg bg-surface-gray-2 p-3"
          >
            <div class="mb-1 text-p-xs font-medium uppercase tracking-wide text-ink-gray-5">
              {{ __('Summary') }}
            </div>
            <p class="whitespace-pre-line text-base text-ink-gray-8">
              {{ media.data.transcript.summary }}
            </p>
          </div>

          <div v-if="showTranscript" class="flex min-w-0 flex-col">
            <div class="mb-2 text-p-xs font-medium uppercase tracking-wide text-ink-gray-5">
              {{ __('Transcript') }}
            </div>

            <!-- B5: gated on `loading && !data`, so a reopen paints the cached transcript instead of
                 throwing it away for a spinner. -->
            <div
              v-if="media?.loading && !media?.data"
              class="text-base text-ink-gray-5"
            >
              {{ __('Loading…') }}
            </div>

            <!-- THE ONE RENDERER. Every rung of the ladder is this markup with fewer parts filled in:
                 speaker+times, speaker only, times only, or one paragraph. No per-provider switch, and a
                 producer that returns bare prose lands here with no frontend change at all. -->
            <FadedScrollableDiv
              v-else-if="segments.length"
              class="flex flex-col gap-2 sm:max-h-[42vh] sm:overflow-y-auto"
            >
              <div
                v-for="(segment, index) in segments"
                :key="index"
                class="flex min-w-0 items-start gap-2"
              >
                <button
                  v-if="segment.start != null"
                  class="mt-0.5 shrink-0 font-mono text-p-xs text-ink-gray-5 hover:text-ink-gray-8"
                  :title="__('Play from here')"
                  @click="seekTo(segment.start)"
                >
                  {{ clock(segment.start) }}
                </button>
                <div
                  :class="[
                    'min-w-0 flex-1 rounded-lg px-3 py-2 text-base text-ink-gray-8',
                    segment.role ? 'bg-surface-gray-2' : '',
                  ]"
                >
                  <div
                    v-if="segment.role"
                    class="mb-0.5 flex items-center gap-1 text-p-xs font-medium text-ink-gray-6"
                  >
                    <SparkleIcon
                      v-if="isAiVoice && segment.role === 'agent'"
                      class="size-3 shrink-0"
                    />
                    {{ roleLabel(segment.role) }}
                  </div>
                  <p class="whitespace-pre-line break-words">{{ segment.text }}</p>
                </div>
              </div>
            </FadedScrollableDiv>

            <p
              v-else-if="media?.data?.transcript?.text"
              class="whitespace-pre-line break-words text-base text-ink-gray-8 sm:max-h-[42vh] sm:overflow-y-auto"
            >
              {{ media.data.transcript.text }}
            </p>

            <p v-else class="text-base text-ink-gray-5">
              {{ __('No transcript for this call.') }}
            </p>
          </div>
        </div>
        </div>
      </div>
      <div
        v-if="!callLog?.data?._lead && !callLog?.data?._deal"
        class="px-4 pb-7 pt-4 sm:px-6"
      >
        <Button
          class="w-full"
          variant="solid"
          :label="__('Create Lead')"
          @click="createLead"
        />
      </div>
    </template>
    <!-- §3: full-width and stacked on mobile, compact and right-aligned on desktop. The sheet renders
         this as its sticky footer, so the primary action is reachable without scrolling the transcript. -->
    <template #actions>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          v-if="referenceRoute"
          class="w-full sm:w-auto"
          variant="ghost"
          :label="referenceLabel"
          :iconRight="ArrowUpRightIcon"
          @click="openReference"
        />
        <!-- The download is OUR file through the proxy, and exists only when the bytes are ours. -->
        <a
          v-if="playableSrc"
          :href="playableSrc"
          :download="downloadName"
          class="w-full sm:w-auto"
        >
          <Button class="w-full" variant="subtle" :label="__('Download')" icon-left="download" />
        </a>
        <Button
          class="w-full sm:w-auto"
          variant="solid"
          :label="__('Done')"
          @click="show = false"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import DurationIcon from '@/components/Icons/DurationIcon.vue'
import ContactsIcon from '@/components/Icons/ContactsIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import Dealsicon from '@/components/Icons/DealsIcon.vue'
import CalendarIcon from '@/components/Icons/CalendarIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import CheckCircleIcon from '@/components/Icons/CheckCircleIcon.vue'
import SparkleIcon from '@/components/Icons/SparkleIcon.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import { getCallLogDetail } from '@/utils/callLog'
import { sanitizeHTML } from '@/utils'
import { isMobileView } from '@/composables/settings'
import { theme } from '@/stores/theme'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { useDocument } from '@/data/document'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import {
  FeatherIcon,
  Dropdown,
  Avatar,
  Badge,
  Tooltip,
  call,
  createResource,
  toast,
} from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { ref, computed, h, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const show = defineModel({ type: Boolean })

const callLog = defineModel('callLog', { type: Object })

const { updateOnboardingStep } = useOnboarding('frappecrm')
const { capture } = useTelemetry()
const { showModal } = useDoctypeModal()

const note = ref('')
const task = ref('')

// TATVA — THE CALL'S ARTIFACTS. One resource, asked when the MODAL OPENS and never from a list: neither
// the Calls tab nor the Call Logs page carries a transcript or a recording in its payload, and nothing
// here is fetched per row. The modal is `v-if`-mounted at all three of its call sites, so setup IS open.
//
// Built inside the watcher rather than at setup because the cache key must name the RECORD (B1/B2) and
// the call is not known until one is chosen. frappe-ui returns the SAME resource object for a repeated
// key, so reopening the same call paints its transcript on the first frame with no spinner (B3) — the
// same shape `CallLogs.showCallLog` already uses for the call log itself.
const media = ref(null)
const player = ref(null)

function loadMedia(name) {
  if (!name) return
  media.value = createResource({
    url: 'tatva_connect.storage.call_media.media_for',
    params: { call: name },
    cache: ['call_media', name],
    // `auto: true` IS the exception to "never auto unless the data is needed on the first frame", and it
    // is deliberate — do not "fix" it. This resource is not created at setup; it is created HERE, and
    // this function only runs once a call is actually on screen in an open modal. So its first frame IS
    // the panel's first frame, and the transcript is needed on it. The alternative — `auto: false` plus a
    // `.fetch()` on the next line — is two triggers for one intent, and the second one is what gets lost.
    auto: true,
  })
}

const isAiVoice = computed(
  () => callLog.value?.data?.telephony_medium === 'AI Voice',
)

const headerTitle = computed(() =>
  isAiVoice.value ? __('AI Voice Call') : __('Call Details'),
)

// The producer is DIAGNOSTIC, not decorative: it tells an operator which service to go and look at, and
// it is deliberately not the badge — a rep does not care who dialled, and a second provider must not
// change what the badge means.
const headerSubtitle = computed(() => {
  const data = media.value?.data
  return data?.recording?.source || data?.transcript?.source || ''
})

// STORED-OR-NOTHING. `media_for` answers with a URL only for bytes we hold; `recording_url_path` is the
// framework's own same-origin streaming proxy for a call whose audio we do not store. Neither is a
// provider's URL — one is never put in the markup, not as a fallback and not temporarily.
const playableSrc = computed(
  () =>
    media.value?.data?.recording?.url ||
    callLog.value?.data?.recording_url_path ||
    '',
)

const downloadName = computed(
  () => media.value?.data?.recording?.file_name || __('recording'),
)

const segments = computed(() => media.value?.data?.transcript?.segments || [])

// The person on the other end of THIS call, as the CRM already knows them — outgoing means they were
// called, incoming means they called. `parse_call_log` has resolved the number to a contact already, so
// nothing is looked up again here.
const contactName = computed(() => {
  const data = callLog.value?.data
  const side = data?.type === 'Incoming' ? data?._caller : data?._receiver
  const label = side?.label || ''
  // `parse_call_log` puts the LITERAL string 'Unknown' here when the number matches no contact
  // (crm_call_log.py: `contact.get("full_name", "Unknown")`). That is a placeholder, not a name, and a
  // bubble labelled "Unknown" is worse than a plain noun — so it is treated as absent.
  return label === 'Unknown' ? '' : label
})

// A stored ROLE is a side of the call; the wording is this screen's to choose, and it chooses the lead's
// OWN NAME over a generic noun — "Pareekshith" reads like a conversation, "Patient" reads like a form.
// A role with no name to put against it falls back to a plain word rather than showing a blank bubble.
function roleLabel(role) {
  if (role === 'agent') return __('Agent')
  return contactName.value || __('Contact')
}

const showTranscript = computed(
  () => isAiVoice.value || Boolean(media.value?.data?.transcript),
)

// The panel exists when the call HAS something to put in it — never because of which provider carried it.
const hasMediaPanel = computed(
  () => Boolean(playableSrc.value) || showTranscript.value,
)

function clock(seconds) {
  const whole = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(
    whole % 60,
  ).padStart(2, '0')}`
}

function seekTo(seconds) {
  if (!player.value) return
  player.value.currentTime = Number(seconds) || 0
  player.value.play()
}

const referenceRoute = computed(() => {
  const data = callLog.value?.data
  if (data?._lead) return { name: 'Lead', params: { leadId: data._lead } }
  if (data?._deal) return { name: 'Deal', params: { dealId: data._deal } }
  return null
})

const referenceLabel = computed(() =>
  callLog.value?.data?._lead ? __('Open lead') : __('Open deal'),
)

function openReference() {
  if (!referenceRoute.value) return
  show.value = false
  router.push(referenceRoute.value)
}

function showNote(name) {
  showModal({
    name,
    doctype: 'FCRM Note',
    title: 'Note',
    callbacks: {
      afterInsert: (d) => addNoteToCallLog(d, true),
      afterUpdate: (d) => addNoteToCallLog(d, false),
    },
  })
}

function showTask(name) {
  showModal({
    name,
    doctype: 'CRM Task',
    title: 'Task',
    defaults: { status: 'Backlog', priority: 'Low' },
    callbacks: {
      afterInsert: (d) => addTaskToCallLog(d, true),
      afterUpdate: (d) => addTaskToCallLog(d, false),
    },
  })
}

async function addNoteToCallLog(_note, isInsert = false) {
  if (isInsert && _note.name) {
    await call('crm.integrations.api.add_note_to_call_log', {
      call_sid: callLog.value?.data?.id,
      note: _note,
    })
    updateOnboardingStep('create_first_note')
    capture('note_created')
  } else {
    capture('note_updated')
  }
  callLog.value?.reload?.()
}

async function addTaskToCallLog(_task, isInsert = false) {
  if (isInsert && _task.name) {
    await call('crm.integrations.api.add_task_to_call_log', {
      call_sid: callLog.value?.data?.id,
      task: _task,
    })
    updateOnboardingStep('create_first_task')
    capture('task_created')
  } else {
    capture('task_updated')
  }
  callLog.value?.reload?.()
}

const detailFields = computed(() => {
  if (!callLog.value?.data) return []

  let data = JSON.parse(JSON.stringify(callLog.value?.data))

  for (const key in data) {
    data[key] = getCallLogDetail(key, data)
  }
  let details = [
    {
      icon: h(FeatherIcon, {
        name: data.type.icon,
        class: 'h-3.5 w-3.5',
      }),
      name: 'type',
      value: data.type.label + ' Call',
    },
    {
      icon: ContactsIcon,
      name: 'receiver',
      value: {
        receiver: data.receiver,
        caller: data.caller,
      },
    },
    {
      icon: data._lead ? LeadsIcon : Dealsicon,
      name: 'reference_doc',
      value: data._lead ? 'Lead' : 'Deal',
      link: () => {
        if (data._lead) {
          router.push({
            name: 'Lead',
            params: { leadId: data._lead },
          })
        } else {
          router.push({
            name: 'Deal',
            params: { dealId: data._deal },
          })
        }
      },
      condition: () => data._lead || data._deal,
    },
    {
      icon: CalendarIcon,
      name: 'creation',
      value: data.creation.label,
      tooltip: data.creation.label,
    },
    {
      icon: DurationIcon,
      name: 'duration',
      value: data.duration.label,
    },
    {
      icon: CheckCircleIcon,
      name: 'status',
      value: data.status.label,
      color: data.status.color,
    },
    {
      icon: NoteIcon,
      name: 'note',
      value: data._notes?.[0] ?? null,
    },
    {
      icon: TaskIcon,
      name: 'task',
      value: data._tasks?.[0] ?? null,
    },
  ]

  return details
    .filter((detail) => detail.value)
    .filter((detail) => (detail.condition ? detail.condition() : true))
})

const d = ref({})
const leadDetails = ref({})

async function createLead() {
  await d.value.triggerOnCreateLead?.(
    callLog.value?.data,
    leadDetails.value,
    () => (show.value = false),
  )

  call('crm.fcrm.doctype.crm_call_log.crm_call_log.create_lead_from_call_log', {
    call_log: callLog.value?.data,
    lead_details: leadDetails.value,
  })
    .then((d) => {
      if (d) {
        router.push({ name: 'Lead', params: { leadId: d } })
      }
    })
    .catch((err) => {
      toast.error(
        __('Error creating lead: {0}', [err.messages?.[0] || err.message]),
      )
    })
}

function openCallLogModal() {
  showModal({
    name: callLog.value?.data?.name,
    doctype: 'CRM Call Log',
    title: 'Call Log',
    callbacks: {
      afterUpdate: () => {
        callLog.value.reload()
        capture('call_log_updated')
      },
    },
  })
}

watch(
  () => callLog.value?.data,
  (data) => {
    if (!data) return
    const parsed = JSON.parse(JSON.stringify(data))
    note.value = parsed._notes?.[0]?.name ?? null
    task.value = parsed._tasks?.[0]?.name ?? null
  },
  { immediate: true, deep: true },
)

watch(
  () => callLog.value?.data?.name,
  (value) => {
    if (!value) return
    d.value = useDocument('CRM Call Log', value)
    // A4: the artifacts are asked for the moment a call is actually on screen, not when its row rendered.
    loadMedia(value)
  },
  { immediate: true },
)
</script>

<style scoped>
.audio-control {
  height: 40px;
  outline: none;
  border-radius: 10px;
  cursor: pointer;
  /* Was `background-color: rgb(237, 237, 237)` — a hardcoded slab that read as a bright block in dark
     mode. The browser draws its own control correctly once told which scheme it is in, and that is bound
     from the app's theme store on the element itself, so this file owns no colour at all. */
}
</style>
