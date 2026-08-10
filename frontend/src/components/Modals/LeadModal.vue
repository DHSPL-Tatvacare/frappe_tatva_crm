<template>
  <ResponsiveDialog
    v-model="show"
    :options="{ size: '3xl', title: __('Create Lead') }"
  >
    <!-- The three slots every modal here uses: the shell draws the title and the close, and #actions becomes the sheet's STICKY footer on mobile — a Create that scrolls away with the fields is the shape this had while it drew its own chrome. -->
    <template #body-title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold text-ink-gray-9">
          {{ __('Create Lead') }}
        </span>
        <Button
          v-if="isManager() && !isMobileView"
          variant="ghost"
          class="w-7"
          :tooltip="__('Edit Fields Layout')"
          :icon="EditIcon"
          @click="openQuickEntryModal"
        />
      </div>
    </template>

    <template #body-content>
      <!-- TATVA: desktop caps the fields and scrolls them so the title and Create stay put (TaskModal's shape); gated on isMobileView, not `sm:`, or the sheet gets a second scroller inside its own drag. -m-1/p-1 keeps focus rings unclipped. -->
      <div
        :class="{
          '-m-1 max-h-[calc(60vh+0.5rem)] overflow-y-auto p-1': !isMobileView,
        }"
      >
        <FieldLayout v-if="tabs.data" :tabs="tabs.data" :data="lead.doc" />
        <!-- TATVA: grain is the user's entitlement, never a free pick — single auto-applies, a
               manager picks. The axis fields are hidden SERVER-side (tatva_connect.lead.quick_entry).
               resolve-wildcard: this is the WRITE side, so a region that wildcards an axis (a rep
               covering a whole group) must resolve to ONE leaf before the lead can be filed. -->
        <GrainSelect v-model="grainKey" class="mt-4" resolve-wildcard />

        <!-- TATVA: on a location-tracked grain the rep is standing at the clinic, so the fix taken here becomes the doctor's anchor — every later visit is measured against it. Inline and skippable: the anchor is set by the first visit anyway (location/api.ensure_anchor). -->
        <div
          v-if="grainTracked"
          class="mt-4 rounded-lg border border-outline-gray-1 p-3"
        >
          <div class="flex items-start gap-1.5 text-xs text-ink-gray-5">
            <FeatherIcon name="map-pin" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{{
              __(
                "This becomes the doctor's clinic location, and every later visit is checked against it. Changing it afterwards needs a manager.",
              )
            }}</span>
          </div>
          <template v-if="fix">
            <div class="mt-2 text-xs text-ink-gray-7">
              {{ fixAddress || __('Locating…') }}
            </div>
            <TatvaMiniMap
              v-if="mapConfig"
              :lat="fix.lat"
              :lng="fix.lng"
              :zoom="mapConfig.zoom"
              :provider="mapConfig.thumbnail"
              :tile-url="mapConfig.tile_url"
              class="mt-2 h-32 w-full rounded-md border border-outline-gray-1"
            />
            <div class="mt-2 flex items-center gap-2">
              <Button
                :label="
                  useFix
                    ? __('Location will be saved')
                    : __('Use this location')
                "
                :variant="useFix ? 'subtle' : 'outline'"
                :icon-left="useFix ? 'check' : 'map-pin'"
                @click="useFix = !useFix"
              />
            </div>
          </template>
        </div>

        <ErrorMessage v-if="error" class="mt-4" :message="__(error)" />
      </div>
    </template>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button
          :label="__('Cancel')"
          :disabled="isLeadCreating"
          @click="show = false"
        />
        <Button
          variant="solid"
          :label="__('Create')"
          :loading="isLeadCreating"
          @click="createNewLead"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import { usersStore } from '@/stores/users'
import { statusesStore } from '@/stores/statuses'
import { sessionStore } from '@/stores/session'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { call, createResource } from 'frappe-ui'
import { useGeolocation } from '@vueuse/core'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import { mapConfig, useMapConfig } from '@/composables/mapConfig'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import GrainSelect from '@/tatva/GrainSelect.vue'
import { useEntitledGrains, axesFromKey } from '@/tatva/useEntitledGrains'
import { useDocument } from '@/data/document'
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  defaults: { type: Object, default: () => ({}) },
})

const { user } = sessionStore()
const { getUser, isManager } = usersStore()
const { getLeadStatus, statusOptions } = statusesStore()
const { updateOnboardingStep } = useOnboarding('frappecrm')

const show = defineModel({ type: Boolean })
const router = useRouter()
const error = ref(null)
const isLeadCreating = ref(false)

const { document: lead, triggerOnBeforeCreate } = useDocument('CRM Lead')

const { capture } = useTelemetry()

const leadStatuses = computed(() => statusOptions('lead'))

// TATVA: grain handling, on the shared brain (useEntitledGrains). A single-grain user's grain is applied silently, a manager picks one. The axis fields are hidden server-side by tatva_connect.lead.quick_entry; the backend (CRM Lead before_validate) is the fail-closed clamp.
const { grainAll, grainOptions, grainLocked } = useEntitledGrains()
const grainKey = ref('')

// TATVA: the grain travels with the request — the server draws the sections its contract declares. No `cache` key: that one was shared by every grain, so a cached TatvaPractice form would reach the next business to open the modal.
const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  makeParams: () => ({
    doctype: 'CRM Lead',
    type: 'Quick Entry',
    ...axesFromKey(grainKey.value),
  }),
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldname == 'status') {
              field.fieldtype = 'Select'
              field.options = leadStatuses.value
              field.prefix = getLeadStatus(lead.doc.status).color
            }

            if (field.fieldtype === 'Table') {
              lead.doc[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

// TATVA: the clinic anchor, on the pieces the activity UI already uses — useGeolocation immediate:false (NM-08: no watch at setup), the shared lazy mapConfig, TatvaMiniMap, and the server's reverse_geocode. Asked only for a tracked grain; the server decides again on insert (capture_on_create), since the grain can still be clamped after this.
const {
  coords,
  resume: resumeGeo,
  pause: pauseGeo,
} = useGeolocation({ immediate: false })
const grainTracked = ref(false)
const useFix = ref(false)
const fixAddress = ref('')
const fix = computed(() =>
  Number.isFinite(coords.value?.latitude) &&
  Number.isFinite(coords.value?.longitude)
    ? { lat: coords.value.latitude, lng: coords.value.longitude }
    : null,
)

watch(fix, async (f) => {
  if (!f) return
  const r = await call('tatva_connect.location.api.reverse_geocode', f)
  fixAddress.value = r?.address || ''
})

const manageGrain = computed(() => !grainAll.value)
// TATVA: the starred fields, read off the layout the server just returned — the form holds no list of its own.
const requiredFields = computed(() =>
  (tabs.data || []).flatMap((tab) =>
    (tab.sections || [])
      .filter((section) => !section.hidden)
      .flatMap((section) =>
        (section.columns || []).flatMap((column) =>
          (column.fields || []).filter((f) => f?.reqd && !f.hidden),
        ),
      ),
  ),
)
// TATVA: `grainLocked` no longer implies the key is settled. With resolve-wildcard, a rep locked to a
// region that wildcards an axis holds NO key until they pick that axis's leaf, so the check covers the
// locked case too — a concrete region still fills itself in on mount and passes untouched.
const grainRequired = computed(
  () => manageGrain.value && grainOptions.value.length > 0,
)
watch(grainKey, async (key) => {
  if (!key) {
    grainTracked.value = false
    pauseGeo()
    return
  }
  const { vertical, group, program } = axesFromKey(key)
  lead.doc.custom_vertical = vertical || null
  lead.doc.custom_group = group || null
  lead.doc.custom_current_program = program || null
  // TATVA: the grain decides which sections the form has, so it is re-asked; typed values live on lead.doc and survive.
  tabs.reload()
  // TATVA: only a grain the operator configured for location capture is ever asked for a position — no prompt, no map config fetch and no GPS watch for any other business line.
  grainTracked.value = await call(
    'tatva_connect.location.api.grain_is_tracked',
    { vertical, group, program },
  )
  if (!grainTracked.value) return pauseGeo()
  useMapConfig()
  resumeGeo()
})

const createLead = createResource({
  url: 'frappe.client.insert',
})

async function createNewLead() {
  if (lead.doc.website && !lead.doc.website.startsWith('http')) {
    lead.doc.website = 'https://' + lead.doc.website
  }

  await triggerOnBeforeCreate?.()

  createLead.submit(
    {
      doc: {
        doctype: 'CRM Lead',
        ...lead.doc,
        // TATVA: `lat`/`lng` — the names save_activity already carries a fix under. No column, so nothing is stored; capture_on_create reads them off the doc and pins the clinic.
        ...(useFix.value && fix.value ? fix.value : {}),
      },
    },
    {
      validate() {
        error.value = null
        if (grainRequired.value && !grainKey.value) {
          // Locked => the region was never theirs to choose, so what is missing is the leaf under it.
          error.value = grainLocked.value
            ? __('Select a program for this lead')
            : __('Select a grain for this lead')
          return error.value
        }
        if (!lead.doc.first_name) {
          error.value = __('First Name is mandatory')
          return error.value
        }
        // TATVA: mandatory on this form only — the doctype field stays optional for API, sync and import.
        if (!lead.doc.mobile_no) {
          error.value = __('Mobile No. is mandatory')
          return error.value
        }
        // TATVA: the same rule for every starred field; the star is the grain's contract, and this form is its only judge.
        const blank = requiredFields.value.find((f) => !lead.doc[f.fieldname])
        if (blank) {
          error.value = __('{0} is mandatory', [
            __(blank.label || blank.fieldname),
          ])
          return error.value
        }
        if (lead.doc.annual_revenue) {
          if (typeof lead.doc.annual_revenue === 'string') {
            lead.doc.annual_revenue = lead.doc.annual_revenue.replace(/,/g, '')
          } else if (isNaN(lead.doc.annual_revenue)) {
            error.value = __('Annual Revenue should be a number')
            return error.value
          }
        }
        if (
          lead.doc.mobile_no &&
          isNaN(lead.doc.mobile_no.replace(/[-+() ]/g, ''))
        ) {
          error.value = __('Mobile No. should be a number')
          return error.value
        }
        if (lead.doc.email && !lead.doc.email.includes('@')) {
          error.value = __('Invalid email address')
          return error.value
        }
        if (!lead.doc.status) {
          error.value = __('Status is required')
          return error.value
        }
        isLeadCreating.value = true
      },
      onSuccess(data) {
        capture('lead_created')
        isLeadCreating.value = false
        show.value = false
        lead.doc = {}
        router.push({ name: 'Lead', params: { leadId: data.name } })
        updateOnboardingStep('create_first_lead', true, false, () => {
          localStorage.setItem('firstLead' + user, data.name)
        })
      },
      onError(err) {
        isLeadCreating.value = false
        if (!err.messages) {
          error.value = err.message
          return
        }
        error.value = err.messages.join('\n')
      },
    },
  )
}

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: 'CRM Lead' }
  nextTick(() => (show.value = false))
}

onMounted(() => {
  lead.doc.no_of_employees = '1-10'
  Object.assign(lead.doc, props.defaults)

  if (!lead.doc?.lead_owner) {
    lead.doc.lead_owner = getUser().name
  }
  if (!lead.doc?.status && leadStatuses.value[0]?.value) {
    lead.doc.status = leadStatuses.value[0].value
  }
})
</script>
