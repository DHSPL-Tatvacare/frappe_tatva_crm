<!-- TATVA: SmartViewShareDialog — Desk's share dialog for a Smart View: edits stay a local draft, and Save replays them as frappe.share.add / set_permission (people) and set_public (the grain), one at a time. -->
<template>
  <ResponsiveDialog
    v-model="show"
    :options="{ title: __('Share view'), size: 'lg' }"
  >
    <template #body-content>
      <!-- Fixed height on desktop and in the sheet, so adding people never grows the dialog; only the list scrolls. -->
      <div class="flex h-[60dvh] min-h-0 flex-col gap-3 sm:h-[50dvh]">
        <Link
          v-if="canShare"
          class="form-control shrink-0"
          :disabled="!loaded || saving"
          value=""
          doctype="User"
          :placeholder="__('Add a person')"
          query="tatva_connect.smartview.api.share_user_query"
          :filters="pickerFilters"
          :hideMe="true"
          @change="(user) => user && add(user)"
        >
          <template #item-prefix="{ option }">
            <UserAvatar class="mr-2" :user="option.value" size="sm" />
          </template>
          <template #item-label="{ option }">
            <span class="min-w-0 flex-1 truncate text-ink-gray-9">
              {{ getUser(option.value).full_name || option.value }}
            </span>
          </template>
        </Link>

        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div
            v-if="shares.error"
            class="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-gray-5"
          >
            {{ __('Could not load who has access.') }}
            <Button :label="__('Try again')" @click="shares.reload()" />
          </div>
          <div
            v-else-if="!loaded"
            class="flex h-full items-center justify-center text-sm text-ink-gray-5"
          >
            {{ __('Loading...') }}
          </div>
          <template v-else>
            <div :class="groupRowClass">
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-gray-3"
              >
                <FeatherIcon name="users" class="h-4 w-4 text-ink-gray-6" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-base text-ink-gray-8">
                  {{ grainRowLabel }}
                </div>
                <div class="truncate text-sm text-ink-gray-5">
                  {{ __('Includes people who join later') }}
                </div>
              </div>
              <FormControl
                v-model="draft[GRAIN]"
                class="w-40 shrink-0"
                type="select"
                :options="grainOptions"
                :disabled="!canShare || saving"
              />
            </div>
            <!-- The group row stands apart from the people under it. -->
            <Divider class="my-1" :flex-item="true" />

            <div v-if="ownerUser" :class="rowClass">
              <UserAvatar :user="ownerUser" size="lg" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-base text-ink-gray-8">
                  {{ getUser(ownerUser).full_name || ownerUser }}
                </div>
                <div class="truncate text-sm text-ink-gray-5">{{ ownerUser }}</div>
              </div>
              <span class="shrink-0 px-2 text-sm text-ink-gray-5">{{ __('Owner') }}</span>
            </div>

            <div v-for="user in people" :key="user" :class="rowClass">
              <UserAvatar :user="user" size="lg" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-base text-ink-gray-8">
                  {{ getUser(user).full_name || user }}
                </div>
                <div class="truncate text-sm text-ink-gray-5">{{ user }}</div>
              </div>
              <FormControl
                v-model="draft[user]"
                class="w-40 shrink-0"
                type="select"
                :options="options(draft[user])"
                :disabled="!canShare || saving"
              />
            </div>
          </template>
        </div>

        <p class="shrink-0 border-t border-outline-gray-1 pt-3 text-p-sm text-ink-gray-5">
          {{ __('People see only the records they already have access to.') }}
        </p>
      </div>
    </template>
    <template v-if="canShare" #actions>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          class="w-full sm:w-auto"
          variant="subtle"
          :label="__('Cancel')"
          :disabled="saving"
          @click="show = false"
        />
        <Button
          class="w-full sm:w-auto"
          variant="solid"
          :label="__('Save')"
          :disabled="!changes.length"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { Button, Divider, FeatherIcon, FormControl, call, createResource, toast } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { usersStore } from '@/stores/users'
import { grainLabel } from '@/tatva/useEntitledGrains'
import { computed, reactive, ref, watch } from 'vue'

const DT = 'CRM Smart View'
const GRAIN = '__grain__'
// frappe-ui's Select drops an option whose value is '', so no access has a value of its own.
const NONE = 'none'
// The SPA's three levels, each one fixed set of Desk's share checkboxes; nobody reading this needs to know the boxes exist.
const LEVELS = {
  view: { label: __('View'), rights: { read: 1, write: 0, share: 0 } },
  edit: { label: __('Edit'), rights: { read: 1, write: 1, share: 0 } },
  share: { label: __('Edit and share'), rights: { read: 1, write: 1, share: 1 } },
}
const rowClass =
  'flex min-w-0 items-center gap-3 border-b border-outline-gray-1 py-2 last:border-b-0'
// The Everyone row: a row with no line of its own, because the Divider under it is the line.
const groupRowClass = 'flex min-w-0 items-center gap-3 py-2'

const props = defineProps({
  viewName: { type: String, required: true },
  ownerUser: { type: String, default: '' },
  canWrite: { type: Boolean, default: false },
  canShare: { type: Boolean, default: false },
  // The view's grain-wide reach (`is_standard`) and its axes, named by the one grain labeller.
  isStandard: { type: Boolean, default: false },
  grain: { type: Object, default: () => ({}) },
})
const show = defineModel({ type: Boolean })
const emit = defineEmits(['changed'])

const { getUser } = usersStore()
const pickerFilters = { view: props.viewName }
const grainRowLabel = computed(() =>
  [props.grain.vertical, props.grain.group, props.grain.program].some(Boolean)
    ? __('Everyone in {0}', [grainLabel(props.grain)])
    : __('Everyone'),
)

const shares = createResource({
  url: 'frappe.share.get_users',
  makeParams: () => ({ doctype: DT, name: props.viewName }),
})
// The grain row's stored state: the prop, then whatever Save last wrote, so a reopen never shows a stale tab row.
const grainShared = ref(props.isStandard)
// What the server holds, as {key: level}; the draft starts as a copy and Save sends only the difference.
const stored = computed(() => {
  const out = { [GRAIN]: grainShared.value ? 'view' : NONE }
  for (const s of shares.data || []) {
    if (s.everyone || s.user === props.ownerUser) continue
    out[s.user] = s.share ? 'share' : s.write ? 'edit' : 'view'
  }
  return out
})
const loaded = computed(() => Array.isArray(shares.data))
const draft = reactive({})
const added = ref([])
const saving = ref(false)

function reset() {
  for (const k of Object.keys(draft)) delete draft[k]
  Object.assign(draft, stored.value)
  added.value = []
}
// Re-seeded when the server answers, never mid-save: Save re-seeds once, after its final reload, so rows never blink.
watch(stored, () => saving.value || reset())

const people = computed(() => [
  ...added.value,
  ...Object.keys(stored.value).filter((k) => k !== GRAIN),
])

const changes = computed(() =>
  Object.keys(draft).filter((k) => draft[k] !== (stored.value[k] || NONE)),
)

// Frappe refuses a grant above the grantor's own rights, so the select offers only what will pass, plus the row's current level.
function options(current) {
  const grantable = { view: true, edit: props.canWrite, share: props.canWrite && props.canShare }
  const opts = Object.entries(LEVELS)
    .filter(([value]) => grantable[value] || value === current)
    .map(([value, l]) => ({ value, label: l.label }))
  return [...opts, { value: NONE, label: __('Remove') }]
}
// The grain reach is read-only by construction (a grain rule grants open, never edit); edit and share go to named people.
const grainOptions = [
  { value: 'view', label: LEVELS.view.label },
  { value: NONE, label: __('No access') },
]

function add(user) {
  if (user === props.ownerUser || user in draft) return
  added.value = [user, ...added.value]
  draft[user] = 'view'
}

// Save replays the draft as Desk's calls, one at a time, then reloads once; a failure keeps the dialog open on the stored truth.
async function save() {
  saving.value = true
  const failed = []
  // Why each row was refused, as the server said it, so the toast names the reason and not only the person.
  const reasons = []
  let grainSaved = false
  // Taken before the first call: a reply can re-seed the draft, and the plan must not change under the loop.
  const plan = changes.value.map((key) => [key, draft[key]])
  for (const [key, level] of plan) {
    try {
      if (key === GRAIN) {
        await call('tatva_connect.smartview.api.set_public', { view: props.viewName, value: level === NONE ? 0 : 1 })
        grainShared.value = level !== NONE
        grainSaved = true
      } else if (level === NONE) {
        await call('frappe.share.set_permission', {
          doctype: DT, name: props.viewName, user: key, permission_to: 'read', value: 0,
        })
      } else {
        await call('frappe.share.add', {
          doctype: DT, name: props.viewName, user: key,
          ...LEVELS[level].rights,
          notify: key in stored.value ? 0 : 1,
        })
      }
    } catch (e) {
      failed.push(key)
      reasons.push(e?.messages?.[0] || e?.message || '')
    }
  }
  await shares.reload()
  saving.value = false
  reset()
  // A failed row keeps the person's choice, so Save can be pressed again; a new person stays in the list.
  for (const [key, level] of plan.filter(([key]) => failed.includes(key))) {
    if (key !== GRAIN && !(key in stored.value)) added.value.push(key)
    draft[key] = level
  }
  // Only the grain row changes who sees the view in their tabs.
  if (grainSaved) emit('changed')
  if (failed.length) {
    const names = failed.map((key) => (key === GRAIN ? grainRowLabel.value : getUser(key).full_name || key))
    const why = [...new Set(reasons.filter(Boolean))].join(' ')
    toast.error(
      why
        ? __('Could not update sharing for {0}: {1}', [names.join(', '), why])
        : __('Could not update sharing for {0}', [names.join(', ')]),
    )
  } else {
    toast.success(__('Sharing updated'))
    show.value = false
  }
}

watch(show, (open) => open && shares.fetch(), { immediate: true })

</script>
