<!--
  TatvaTaskModal — the ONE config-driven modal for an activity task: view, complete, and create.

  Three modes off the SAME config contract (config.fields[] + is_logged_complete + captures_location):
    • view     — read-only, pre-filled grid in schema order (depends_on-aware) + the captured map.
    • complete — native editable form for an OPEN task; on submit runs the location lifecycle
                 (needed? → GPS → precheck gate → save_activity) against the EXACT task.name.
    • create   — same editable form for an ad-hoc punch (no task yet); save_activity(task=undefined).

  All rules live in tatva_connect (location_needed / precheck / save_activity / enforce_* backstops);
  this is the native skin + client lifecycle only. Controls mirror the CRM's own Field.vue (FormControl,
  DateTimePicker, Link) so it looks 100% native. The out-of-range block + capture receipt reuse the
  server's key-safe static_map proxy (Google stays server-side); card thumbnails stay on OSM.
-->
<template>
  <Dialog v-model="show" :options="{ size: 'lg' }">
    <template #body-title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold text-ink-gray-9">{{ task?.title || task?.task_type }}</span>
        <span v-if="task?.name" class="text-sm text-ink-gray-4">#{{ task.name }}</span>
      </div>
    </template>

    <template #body-content>
      <div class="flex flex-col gap-5">
        <div v-if="task?.task_type" class="flex items-center gap-2">
          <Badge variant="subtle" theme="gray" size="sm" :label="task.task_type" />
          <Badge
            v-if="task.status && !editing"
            variant="subtle"
            :theme="statusTheme(task.status)"
            size="sm"
            :label="task.status"
          />
        </div>

        <!-- VIEW: read-only grid -->
        <template v-if="!editing">
          <div v-if="rows.length" class="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            <div v-for="r in rows" :key="r.label" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">{{ __(r.label) }}</div>
              <a
                v-if="isAttach(r.fieldtype)"
                :href="r.value"
                target="_blank"
                rel="noopener noreferrer"
                class="break-all text-sm text-ink-gray-8 underline"
              >
                {{ fileName(r.value) }}
              </a>
              <div v-else class="break-words text-sm text-ink-gray-8">{{ r.value }}</div>
            </div>
          </div>

          <div v-if="notes">
            <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Notes') }}</div>
            <div class="whitespace-pre-wrap break-words text-sm text-ink-gray-8">{{ notes }}</div>
          </div>

          <div v-if="!rows.length && !notes" class="text-sm text-ink-gray-5">
            {{ __('No details were captured for this task.') }}
          </div>

          <div v-if="task?.location">
            <div class="mb-1.5 flex items-start gap-1 text-xs text-ink-gray-5">
              <span>📍</span><span>{{ task.location.address || __('Visit location') }}</span>
            </div>
            <TatvaMiniMap
              :lat="task.location.lat"
              :lng="task.location.lng"
              :zoom="mapConfig.zoom || 16"
              :provider="mapConfig.thumbnail"
              :tile-url="mapConfig.tile_url"
              class="h-44 w-full rounded-lg border border-outline-gray-1"
            />
          </div>
        </template>

        <!-- COMPLETE / CREATE: native editable form -->
        <template v-else>
          <div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div v-for="f in visibleFields" :key="f.fieldname" class="min-w-0">
              <label class="mb-1.5 block text-sm text-ink-gray-5">
                {{ __(f.label) }}<span v-if="f.reqd" class="text-ink-red-3">*</span>
              </label>

              <FormControl
                v-if="f.fieldtype === 'Select'"
                type="select"
                :options="optionList(f)"
                v-model="form[f.fieldname]"
              />
              <DateTimePicker
                v-else-if="f.fieldtype === 'Datetime'"
                :value="form[f.fieldname]"
                :format="datetimeFormat"
                :placeholder="__('Select date & time')"
                @change="(v) => (form[f.fieldname] = v)"
              />
              <DatePicker
                v-else-if="f.fieldtype === 'Date'"
                :value="form[f.fieldname]"
                :format="dateFormat"
                :placeholder="__('Select date')"
                @change="(v) => (form[f.fieldname] = v)"
              />
              <Link
                v-else-if="f.fieldtype === 'Link' || f.fieldtype === 'User'"
                :value="form[f.fieldname]"
                :doctype="f.fieldtype === 'User' ? 'User' : f.options || 'User'"
                :placeholder="__('Select {0}', [f.label])"
                @change="(v) => (form[f.fieldname] = v)"
              />
              <div v-else-if="f.fieldtype === 'Check'" class="flex h-8 items-center">
                <FormControl type="checkbox" v-model="form[f.fieldname]" />
              </div>
              <FormControl
                v-else-if="['Small Text', 'Text', 'Long Text'].includes(f.fieldtype)"
                type="textarea"
                v-model="form[f.fieldname]"
              />
              <AttachControl
                v-else-if="isAttach(f.fieldtype)"
                :value="form[f.fieldname]"
                doctype="CRM Lead"
                :docname="lead"
                :imageOnly="f.fieldtype === 'Attach Image'"
                @change="(url) => (form[f.fieldname] = url)"
              />
              <FormControl v-else type="text" v-model="form[f.fieldname]" />
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm text-ink-gray-5">{{ __('Notes') }}</label>
            <FormControl type="textarea" v-model="form.notes" :placeholder="__('Optional notes')" />
          </div>

          <div v-if="config?.captures_location" class="flex items-start gap-1.5 text-xs text-ink-gray-5">
            <span>📍</span>
            <span>{{ __('Your location will be captured and checked against the doctor when you complete this visit.') }}</span>
          </div>
        </template>
      </div>
    </template>

    <template #actions>
      <div class="flex justify-end gap-2">
        <template v-if="editing">
          <Button :label="__('Cancel')" :disabled="submitting" @click="cancel" />
          <Button
            variant="solid"
            :label="isCreate ? __('Log Activity') : __('Complete')"
            :loading="submitting"
            @click="submit"
          />
        </template>
        <template v-else>
          <Button
            v-if="config?.fields?.length"
            :label="task?.status === 'Done' ? __('Edit') : __('Complete')"
            iconLeft="edit-2"
            @click="editing = true"
          />
          <Button variant="solid" :label="__('Close')" @click="show = false" />
        </template>
      </div>
    </template>
  </Dialog>

  <!-- Secondary notice: out-of-range block + capture receipt (server static_map proxy, key-safe) -->
  <Dialog v-model="noticeOpen" :options="{ size: 'sm' }">
    <template #body-title>
      <span class="text-lg font-semibold text-ink-gray-9">
        {{ notice?.kind === 'blocked' ? __('Too far from the doctor') : __('Visit location captured') }}
      </span>
    </template>
    <template #body-content>
      <TatvaMiniMap
        v-if="notice"
        :lat="notice.lat"
        :lng="notice.lng"
        :here="notice.here || null"
        :zoom="15"
        :provider="mapConfig.dialog"
        :tile-url="mapConfig.tile_url"
        class="mb-3 h-44 w-full rounded-lg border border-outline-gray-1"
      />
      <div v-if="notice?.kind === 'blocked'" class="text-sm text-ink-gray-7">
        {{ __('Reach within {0} m of the doctor to log this visit — you are {1} m away.', [notice.allowed_m, notice.distance_m]) }}
        <div v-if="notice.address" class="mt-2 text-xs text-ink-gray-5">📍 {{ notice.address }}</div>
      </div>
      <div v-else class="text-sm text-ink-gray-7">{{ __('Logged at your current location.') }}</div>
    </template>
    <template #actions>
      <Button variant="solid" class="w-full" :label="__('Okay')" @click="noticeOpen = false" />
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Dialog, Badge, Button, FormControl, DateTimePicker, DatePicker, call, toast } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import AttachControl from '@/components/Controls/AttachControl.vue'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import { evaluateDependsOnValue, getFormat } from '@/utils'

const props = defineProps({
  task: { type: Object, default: null }, // { name, title, task_type, status, values, location }
  config: { type: Object, default: null }, // { fields[], is_logged_complete, captures_location }
  lead: { type: String, default: '' },
  mode: { type: String, default: 'view' }, // 'view' | 'complete' | 'create'
  mapConfig: {
    type: Object,
    default: () => ({
      thumbnail: 'osm',
      dialog: 'google',
      zoom: 16,
      tile_url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    }),
  },
})
const show = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['saved'])

const form = reactive({})
const editing = ref(false)
const submitting = ref(false)
const notice = ref(null)

const datetimeFormat = getFormat('', '', true, true, false)
const dateFormat = getFormat('', '', true, false, false)

const fields = computed(() => props.config?.fields || [])
const isCreate = computed(() => props.mode === 'create' || !props.task?.name)

// Editable form: schema fields whose depends_on currently passes (evaluated against live form state).
const visibleFields = computed(() =>
  fields.value.filter((f) => !f.depends_on || evaluateDependsOnValue(f.depends_on, form)),
)

// View grid: saved values, depends_on-filtered, only those that hold a value.
const readValues = computed(() => props.task?.values || {})
const rows = computed(() =>
  fields.value
    .filter((f) => !f.depends_on || evaluateDependsOnValue(f.depends_on, readValues.value))
    .map((f) => ({ label: f.label, value: readValues.value[f.fieldname], fieldtype: f.fieldtype }))
    .filter((r) => !isEmpty(r.value)),
)
const notes = computed(() => readValues.value.notes || '')

// Attach is a fieldtype whose value is a file_url. The native AttachControl uploads to the LEAD (which
// always exists — view/complete/create), so the File row is saved attached to CRM Lead → shows in the
// lead's Attachments tab + native audit/timeline, Azure-private (fail-closed). No custom linking code.
// View mode renders the stored file_url as a download link.
function isAttach(ft) {
  return ft === 'Attach' || ft === 'Attach Image'
}
function fileName(url) {
  if (!url) return ''
  // The proxy URL's PATH ends in the method name; the real file is in the `file_name` query param
  // (the blob key '<doctype>/<record>/<hash>_<name>'). Fall back to the path for non-proxy URLs.
  const m = /[?&]file_name=([^&]+)/.exec(url)
  let raw = (m ? decodeURIComponent(m[1]) : url).split('?')[0].split('#')[0].split('/').pop() || url
  raw = raw.replace(/^[a-f0-9]{8,}_/i, '') // strip the blob-key hash prefix
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

watch(show, (open) => {
  if (!open) return
  editing.value = props.mode !== 'view'
  resetForm()
})

function resetForm() {
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, isCreate.value ? {} : { ...(props.task?.values || {}) })
}

function optionList(f) {
  const opts = (f.options || '')
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean)
  return [{ label: '', value: '' }, ...opts.map((o) => ({ label: o, value: o }))]
}

function isEmpty(v) {
  return v === null || v === undefined || v === ''
}

function cancel() {
  if (props.mode === 'view') editing.value = false
  else show.value = false
}

function getGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

// THE location lifecycle (post-form): does this submission need a fix? → GPS → server gate.
// Returns the fix to merge into values, null (not needed), or 'abort' (denied/blocked — UX already shown).
async function resolveLocation(values) {
  const taskType = props.task.task_type
  let needed = false
  try {
    needed = await call('tatva_connect.location.api.location_needed', {
      lead: props.lead,
      task_type: taskType,
      values: JSON.stringify(values),
    })
  } catch {
    return null
  }
  if (!needed) return null

  const pos = await getGPS()
  if (!pos) {
    toast.error(__('Allow location access to log this in-person visit.'))
    return 'abort'
  }
  let pre
  try {
    pre = await call('tatva_connect.location.api.precheck', {
      lead: props.lead,
      task_type: taskType,
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      values: JSON.stringify(values),
      task: props.task?.name || undefined,
    })
  } catch {
    toast.error(__("Couldn't verify your location — please try again."))
    return 'abort'
  }
  if (pre && pre.ok === false) {
    notice.value = {
      kind: 'blocked',
      lat: pre.anchor_lat,
      lng: pre.anchor_lng,
      here: { lat: pos.lat, lng: pos.lng },
      distance_m: pre.distance_m,
      allowed_m: pre.allowed_m,
      address: pre.anchor_address,
    }
    toast.error(__('You are {0} m away — too far to log this visit.', [pre.distance_m]))
    return 'abort'
  }
  return { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy }
}

async function submit() {
  if (submitting.value) return
  const missing = visibleFields.value.filter((f) => f.reqd && isEmpty(form[f.fieldname]))
  if (missing.length) {
    toast.error(__('Please fill: {0}', [missing.map((f) => f.label).join(', ')]))
    return
  }
  submitting.value = true
  try {
    const values = {}
    for (const f of visibleFields.value) values[f.fieldname] = form[f.fieldname]
    if (form.notes) values.notes = form.notes

    const fix = await resolveLocation(values)
    if (fix === 'abort') return
    if (fix) Object.assign(values, fix)

    const name = await call('tatva_connect.activity.api.save_activity', {
      lead: props.lead,
      task_type: props.task.task_type,
      values: JSON.stringify(values),
      task: props.task?.name || undefined,
    })
    toast.success(isCreate.value ? __('Activity logged.') : __('Task completed.'))
    emit('saved', name)
    show.value = false
    if (fix && fix.lat) notice.value = { kind: 'receipt', lat: fix.lat, lng: fix.lng }
  } catch (e) {
    toast.error(errMsg(e) || __('Could not save — please try again.'))
  } finally {
    submitting.value = false
  }
}

function errMsg(e) {
  return (e && (e.messages?.[0] || e.message)) || ''
}

const noticeOpen = computed({
  get: () => !!notice.value,
  set: (v) => {
    if (!v) notice.value = null
  },
})

function statusTheme(status) {
  return (
    { Done: 'green', Canceled: 'red', 'In Progress': 'blue', Todo: 'orange', Backlog: 'gray' }[status] ||
    'gray'
  )
}
</script>
