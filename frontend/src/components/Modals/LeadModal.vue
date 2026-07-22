<template>
  <ResponsiveDialog v-model="show" :options="{ size: '3xl' }">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __('Create Lead') }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager() && !isMobileView"
              variant="ghost"
              class="w-7"
              :tooltip="__('Edit Fields Layout')"
              :icon="EditIcon"
              @click="openQuickEntryModal"
            />
            <Button
              variant="ghost"
              class="w-7"
              icon="x"
              @click="show = false"
            />
          </div>
        </div>
        <div>
          <FieldLayout v-if="layoutTabs" :tabs="layoutTabs" :data="lead.doc" />
          <!-- TATVA: grain is the user's entitlement, never a free pick — single auto-applies, a
               manager picks. Strips the forced vertical/group/program fields above (see layoutTabs).
               resolve-wildcard: this is the WRITE side, so a region that wildcards an axis (a rep
               covering a whole group) must resolve to ONE leaf before the lead can be filed. -->
          <GrainSelect v-model="grainKey" class="mt-4" resolve-wildcard />
          <ErrorMessage v-if="error" class="mt-4" :message="__(error)" />
        </div>
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            variant="solid"
            :label="__('Create')"
            :loading="isLeadCreating"
            @click="createNewLead"
          />
        </div>
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
import { createResource } from 'frappe-ui'
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

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'CRM Lead'],
  params: { doctype: 'CRM Lead', type: 'Quick Entry' },
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

// TATVA: grain handling, on the shared brain (useEntitledGrains). Everyone except a System Manager
// has the forced vertical/group/program fields stripped from the form; a single-grain user's grain is
// applied silently, a manager picks one. The backend (CRM Lead before_validate) is the fail-closed clamp.
const { grainAll, grainOptions, grainLocked } = useEntitledGrains()
const grainKey = ref('')
const manageGrain = computed(() => !grainAll.value)
// TATVA: `grainLocked` no longer implies the key is settled. With resolve-wildcard, a rep locked to a
// region that wildcards an axis holds NO key until they pick that axis's leaf, so the check covers the
// locked case too — a concrete region still fills itself in on mount and passes untouched.
const grainRequired = computed(
  () => manageGrain.value && grainOptions.value.length > 0,
)
const GRAIN_FIELDS = ['custom_vertical', 'custom_group', 'custom_current_program']
const layoutTabs = computed(() => {
  const data = tabs.data
  if (!data || !manageGrain.value) return data // System Manager keeps the native grain fields
  return data.map((tab) => ({
    ...tab,
    sections: tab.sections
      .map((section) => ({
        ...section,
        columns: section.columns.map((column) => ({
          ...column,
          fields: column.fields.filter(
            (f) => !GRAIN_FIELDS.includes(f.fieldname),
          ),
        })),
      }))
      // TATVA: stripping the grain fields can empty a section; Section.vue has no empty check, so drop it here or it renders as a bare header.
      .filter((section) => section.columns.some((column) => column.fields.length)),
  }))
})
watch(grainKey, (key) => {
  if (!key) return
  const { vertical, group, program } = axesFromKey(key)
  lead.doc.custom_vertical = vertical || null
  lead.doc.custom_group = group || null
  lead.doc.custom_current_program = program || null
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
