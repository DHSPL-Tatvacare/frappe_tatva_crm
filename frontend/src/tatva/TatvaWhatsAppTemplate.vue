<!--
  TatvaWhatsAppTemplate — the ONE WhatsApp Send-Template dialog (the native CRM selector is unwired).

  Pick → preview → fill → send, all in one native Dialog. Rides the tatva_connect backend ONLY
  (grain-scoped routing + WATI), never crm.api.whatsapp.send_whatsapp_template:
    • get_send_context        → resolved account (grain route) + mobile_no + approved templates
    • get_template_variables  → body + variable list (real WATI param names when scraped)
    • get_field_options       → grain-scoped lead fields a variable can be filled from
    • send_template_with_params → send via WATI (doctype override persists the WhatsApp Message)
    • templates_sync.sync_from_wati → on-demand template refresh

  Native frappe-ui only (Dialog/Autocomplete/FormControl/Button) → follows the theme automatically.
  Preview is built from safe text segments (no v-html). No business logic here — server decides
  routing, templates, and the send. Lives in frontend/src/tatva/ (additive — never conflicts).
-->
<template>
  <Dialog v-model="show" :options="{ title: __('Send WhatsApp Template'), size: 'xl' }">
    <template #body-content>
      <div v-if="loading" class="flex h-40 items-center justify-center">
        <LoadingIndicator class="h-6 w-6 text-ink-gray-4" />
      </div>

      <div v-else-if="!account" class="flex flex-col gap-2 py-4">
        <div class="text-sm text-ink-gray-7">
          {{ __('To:') }} <span class="font-medium text-ink-gray-9">{{ to || '—' }}</span>
        </div>
        <div class="text-sm text-ink-gray-5">
          {{ __('This lead has no WATI account route (Product Line / Group / Program), so no template can be sent. Set its routing to enable WhatsApp.') }}
        </div>
      </div>

      <div v-else class="flex flex-col gap-4">
        <!-- account + refresh -->
        <div class="flex items-start justify-between gap-3">
          <div class="text-xs leading-relaxed text-ink-gray-5">
            <div>
              {{ __('From:') }}
              <span class="font-medium text-ink-gray-8">{{ account.name }}</span>
              · {{ account.number || '—' }}
            </div>
            <div>
              {{ __('To:') }} <span class="font-medium text-ink-gray-8">{{ to || '—' }}</span>
            </div>
          </div>
          <Button
            :label="__('Refresh templates')"
            :loading="refreshing"
            size="sm"
            @click="refreshTemplates"
          >
            <template #prefix>
              <FeatherIcon name="refresh-cw" class="h-3.5 w-3.5" />
            </template>
          </Button>
        </div>

        <!-- template picker -->
        <div>
          <label class="mb-1.5 block text-sm text-ink-gray-5">{{ __('Template') }}</label>
          <Autocomplete
            :options="templateOptions"
            :value="selectedTemplate"
            :placeholder="__('Search or select a template…')"
            @change="(o) => onPickTemplate(o)"
          />
          <div v-if="!templates.length" class="mt-2 text-sm text-ink-gray-5">
            {{ __('No approved templates synced yet — click Refresh templates to pull them from WATI.') }}
          </div>
        </div>

        <!-- preview + variables -->
        <div v-if="selectedTemplate" class="flex flex-col gap-3">
          <div
            v-if="templateLoading"
            class="flex h-16 items-center justify-center rounded-lg border border-outline-gray-1"
          >
            <LoadingIndicator class="h-5 w-5 text-ink-gray-4" />
          </div>
          <template v-else>
            <div class="rounded-lg border border-outline-gray-1 bg-surface-gray-1 p-3 text-sm leading-relaxed text-ink-gray-7">
              <span v-for="(seg, i) in previewSegments" :key="i">
                <span
                  v-if="seg.chip"
                  class="rounded bg-surface-gray-4 px-1 font-semibold text-ink-gray-8"
                  >{{ seg.chip }}</span
                ><span v-else class="whitespace-pre-wrap">{{ seg.text }}</span>
              </span>
            </div>

            <div v-for="v in variables" :key="v.index" class="flex flex-col gap-1.5">
              <label class="text-sm text-ink-gray-5">
                {{ varLabel(v) }}
                <span v-if="v.hint" class="font-normal text-ink-gray-4"> ({{ __('e.g.') }} {{ v.hint }})</span>
              </label>
              <div class="flex items-center gap-2">
                <FormControl
                  type="text"
                  class="flex-1"
                  :placeholder="__('Type a value, or pick a field…')"
                  v-model="values[v.index]"
                />
                <Dropdown :options="fieldDropdown(v.index)" placement="bottom-end">
                  <Button :label="__('Field')" size="sm">
                    <template #suffix>
                      <FeatherIcon name="chevron-down" class="h-3.5 w-3.5" />
                    </template>
                  </Button>
                </Dropdown>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <template v-if="account" #actions>
      <Button
        variant="solid"
        class="w-full"
        :label="__('Send')"
        :loading="sending"
        :disabled="!selectedTemplate"
        @click="send"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Dialog, Button, FormControl, Dropdown, FeatherIcon, call, toast } from 'frappe-ui'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'

const props = defineProps({
  doctype: { type: String, default: '' },
  docname: { type: String, default: '' },
})
const show = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['sent'])

const loading = ref(false)
const refreshing = ref(false)
const templateLoading = ref(false)
const sending = ref(false)

const account = ref(null)
const to = ref('')
const templates = ref([])
const selectedTemplate = ref('')
const templateInfo = ref(null)
const fieldGroups = ref([])
const values = reactive({})

const variables = computed(() => templateInfo.value?.variables || [])

const templateOptions = computed(() =>
  templates.value
    .slice()
    .sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name))
    .map((t) => ({
      label: t.label || t.name,
      value: t.name,
      description:
        (t.category || 'OTHER') +
        ' · ' +
        (t.vars ? t.vars + ' var' + (t.vars > 1 ? 's' : '') : __('no variables')),
    })),
)

function varLabel(v) {
  return v.name && v.name !== String(v.index) ? v.name : __('Variable {0}', [v.index])
}

// Safe preview: split the body on {{N}} into text/chip segments (no v-html).
const previewSegments = computed(() => {
  const body = templateInfo.value?.body || ''
  const nameByIdx = {}
  variables.value.forEach((v) => (nameByIdx[v.index] = varLabel(v)))
  const parts = []
  let last = 0
  const re = /\{\{\s*(\d+)\s*\}\}/g
  let m
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index) })
    parts.push({ chip: nameByIdx[m[1]] || __('Variable {0}', [m[1]]) })
    last = m.index + m[0].length
  }
  if (last < body.length) parts.push({ text: body.slice(last) })
  return parts
})

// Grouped field options → flat dropdown that sets the variable input on pick.
function fieldDropdown(index) {
  const groups = fieldGroups.value || []
  const opts = []
  groups.forEach((g) => {
    g.options.forEach((o) => {
      opts.push({
        label: g.group + ' · ' + o.label,
        onClick: () => {
          values[index] = o.value
        },
      })
    })
  })
  return opts
}

async function loadContext() {
  loading.value = true
  account.value = null
  resetSelection()
  try {
    const ctx = await call('tatva_connect.api.whatsapp.get_send_context', {
      reference_doctype: props.doctype,
      reference_name: props.docname,
    })
    account.value = (ctx && ctx.account) || null
    to.value = (ctx && ctx.mobile_no) || ''
    templates.value = (ctx && ctx.templates) || []
  } catch (e) {
    toast.error(errMsg(e) || __('Could not load WhatsApp templates.'))
  } finally {
    loading.value = false
  }
}

async function loadFieldGroups() {
  if (fieldGroups.value.length) return
  try {
    fieldGroups.value =
      (await call('tatva_connect.api.whatsapp.get_field_options', {
        reference_doctype: props.doctype,
        reference_name: props.docname,
      })) || []
  } catch {
    fieldGroups.value = []
  }
}

async function onPickTemplate(opt) {
  const name = opt?.value || ''
  selectedTemplate.value = name
  templateInfo.value = null
  Object.keys(values).forEach((k) => delete values[k])
  if (!name) return
  templateLoading.value = true
  try {
    const info = await call('tatva_connect.api.whatsapp.get_template_variables', { template: name })
    templateInfo.value = info || { body: '', variables: [] }
    if (variables.value.length) await loadFieldGroups()
    variables.value.forEach((v) => (values[v.index] = ''))
  } catch (e) {
    toast.error(errMsg(e) || __('Could not load the template.'))
    selectedTemplate.value = ''
  } finally {
    templateLoading.value = false
  }
}

async function refreshTemplates() {
  if (refreshing.value || !account.value) return
  refreshing.value = true
  try {
    await call('tatva_connect.whatsapp.templates_sync.sync_from_wati', {
      account_name: account.value.name,
    })
    const ctx = await call('tatva_connect.api.whatsapp.get_send_context', {
      reference_doctype: props.doctype,
      reference_name: props.docname,
    })
    templates.value = (ctx && ctx.templates) || []
    resetSelection()
    toast.success(
      __('Synced {0} template(s) from WATI', [templates.value.length]),
    )
  } catch (e) {
    toast.error(errMsg(e) || __('Template sync failed.'))
  } finally {
    refreshing.value = false
  }
}

async function send() {
  if (sending.value || !selectedTemplate.value) return
  const bodyParam = {}
  let missing = false
  variables.value.forEach((v) => {
    const val = (values[v.index] || '').trim()
    if (!val) missing = true
    bodyParam[v.index] = val
  })
  if (variables.value.length && missing) {
    toast.error(__('Please fill every variable.'))
    return
  }
  sending.value = true
  try {
    await call('tatva_connect.api.whatsapp.send_template_with_params', {
      reference_doctype: props.doctype,
      reference_name: props.docname,
      template: selectedTemplate.value,
      to: to.value,
      body_param: variables.value.length ? JSON.stringify(bodyParam) : null,
    })
    toast.success(__('WhatsApp template sent.'))
    emit('sent')
    show.value = false
  } catch (e) {
    toast.error(errMsg(e) || __('Could not send the template.'))
  } finally {
    sending.value = false
  }
}

function resetSelection() {
  selectedTemplate.value = ''
  templateInfo.value = null
  Object.keys(values).forEach((k) => delete values[k])
}

function errMsg(e) {
  return (e && (e.messages?.[0] || e.message)) || ''
}

watch(show, (open) => {
  if (open) loadContext()
})
</script>
