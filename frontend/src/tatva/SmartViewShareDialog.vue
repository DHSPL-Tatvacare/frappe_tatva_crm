<!--
  TATVA: SmartViewShareDialog — who else may open this Smart View.

  It is frappe's OWN sharing (DocShare) end to end: the backend calls `frappe.share.add/remove`, and this
  only picks a user and lists who is already on it. No share table, no share concept, and no permission
  rule invented here.

  THE THING WORTH SAYING OUT LOUD, and it is said in the dialog too: sharing a view shares a QUESTION,
  never an answer. Every run still applies the viewer's own permissions, so two people opening one shared
  view see different rows. That is why this is safe to hand out across business lines.

  "Everyone" and "a person" are two different acts, so only one is on screen at a time: with the view
  offered to the whole grain, naming individuals means nothing and the picker is hidden. Both ride the one
  write gate — you may hand on a view you may edit — so the dialog draws no control the server refuses.

  The picker is the SAME shape AssignToBody.vue uses — a `Link` over User plus removable chips — so
  choosing a person feels identical to assigning one.
-->
<template>
  <ResponsiveDialog
    v-model="show"
    :options="{ title: __('Share view'), size: 'lg' }"
  >
    <template #body-content>
      <div class="flex flex-col gap-4">
        <!-- Everyone, and deliberately first: it is the biggest thing this dialog does. -->
        <div
          class="flex items-start justify-between gap-3 rounded-lg bg-surface-gray-2 p-3"
        >
          <div class="min-w-0">
            <div class="text-base font-medium text-ink-gray-8">
              {{ __('Share with everyone in this grain') }}
            </div>
            <p class="mt-0.5 text-p-sm text-ink-gray-5">
              {{
                __(
                  'The view appears for everyone entitled to its business line. It stays yours, so you can take it back.',
                )
              }}
            </p>
          </div>
          <Switch v-model="isPublic" @update:modelValue="onPublic" />
        </div>

        <div v-if="!isPublic">
          <div class="mb-1.5 text-base text-ink-gray-5">
            {{ __('Share with a person') }}
          </div>
          <!-- The picker's OWN slots, not a parallel list: `item-prefix` is the avatar (AssignmentModal
               .vue:52) and `item-label` marks who already has it. Without the tick the dropdown offered
               thirteen names with no sign that twelve were already shared, so the only way to find out
               was to pick one and watch nothing happen. -->
          <Link
            class="form-control"
            value=""
            doctype="User"
            :placeholder="__('Search a user')"
            :filters="{ ignore_user_type: 1 }"
            :hideMe="true"
            @change="(user) => user && addUser(user)"
          >
            <template #item-prefix="{ option }">
              <UserAvatar class="mr-2" :user="option.value" size="sm" />
            </template>
            <template #item-label="{ option }">
              <div class="flex flex-1 items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-ink-gray-9">
                  {{ getUser(option.value).full_name || option.value }}
                </span>
                <FeatherIcon
                  v-if="sharedWith.has(option.value)"
                  name="check"
                  class="h-4 w-4 shrink-0 text-ink-green-3"
                />
              </div>
            </template>
          </Link>
        </div>

        <div v-if="!isPublic && people.length">
          <!-- A count and a way out: thirteen chips with no heading read as a wall, and removing them
               one at a time is the only thing the list offered. -->
          <div class="mb-1.5 flex items-center justify-between">
            <span class="text-base text-ink-gray-5">
              {{ __('Shared with {0}', [people.length]) }}
            </span>
            <Button
              variant="ghost"
              size="sm"
              :label="__('Remove all')"
              :loading="removingAll"
              @click="removeAll"
            />
          </div>
          <!-- Bounded: a long share list scrolls inside its own box instead of pushing the footer off. -->
          <div class="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            <Tooltip v-for="p in people" :key="p.user" :text="p.user">
              <div
                class="flex cursor-pointer items-center rounded-full border border-outline-gray-1 bg-surface-modal p-0.5 text-sm text-ink-gray-6"
              >
                <UserAvatar :user="p.user" size="sm" />
                <div class="ml-1">{{ getUser(p.user).full_name || p.user }}</div>
                <Button
                  variant="ghost"
                  class="m-1 !size-4 rounded-full"
                  @click.stop="removeUser(p.user)"
                >
                  <template #icon>
                    <FeatherIcon name="x" class="h-3 w-3 text-ink-gray-6" />
                  </template>
                </Button>
              </div>
            </Tooltip>
          </div>
        </div>
        <p v-else-if="!isPublic" class="text-p-sm text-ink-gray-5">
          {{ __('Not shared with anyone yet.') }}
        </p>

        <!-- The one thing someone needs to know before handing a view on. -->
        <p
          class="border-t border-outline-gray-1 pt-3 text-p-sm text-ink-gray-5"
        >
          {{ __('User permissions are still applied.') }}
        </p>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { Button, FeatherIcon, Switch, Tooltip, call, toast } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { usersStore } from '@/stores/users'
import { computed, ref, watch } from 'vue'

const props = defineProps({
  viewName: { type: String, required: true },
  isStandard: { type: Boolean, default: false },
})
const show = defineModel({ type: Boolean })
const emit = defineEmits(['changed'])

const { getUser } = usersStore()

const people = ref([])
const isPublic = ref(props.isStandard)
const removingAll = ref(false)
// The set the picker ticks against — derived, so it can never disagree with the chips beside it.
const sharedWith = computed(() => new Set(people.value.map((p) => p.user)))

// Fetched on OPEN (A4); `immediate` because the mount site is v-if, so setup IS open (SmartViewList.vue:199).
watch(
  show,
  (open) => {
    if (!open) return
    isPublic.value = props.isStandard
    call('tatva_connect.smartview.api.shared_with', { view: props.viewName })
      .then((rows) => (people.value = rows || []))
      .catch(() => (people.value = []))
  },
  { immediate: true },
)

// Both endpoints ANSWER with the new recipient list, so this list is never refetched to learn what it
// just did. Neither emits `changed`: `changed` reloads the whole tab list, and handing the view to
// someone else changes nothing on THIS person's tabs — the view was already theirs. Only publishing does
// (below), because `is_standard` is drawn on the tab row.
function addUser(user) {
  if (people.value.some((p) => p.user === user)) return
  call('tatva_connect.smartview.api.share_view', { view: props.viewName, user })
    .then((rows) => (people.value = rows || []))
    .catch((e) =>
      toast.error(e.messages?.[0] || __('Could not share this view')),
    )
}

function removeUser(user) {
  call('tatva_connect.smartview.api.unshare_view', {
    view: props.viewName,
    user,
  })
    .then((rows) => (people.value = rows || []))
    .catch((e) =>
      toast.error(e.messages?.[0] || __('Could not remove this share')),
    )
}

// One call per person, because `unshare_view` is the one door and a second bulk endpoint would be a
// second rule for the same act. The list is taken from the LAST answer rather than accumulated, so a
// share removed by someone else mid-loop cannot resurrect in this dialog.
async function removeAll() {
  if (!people.value.length || removingAll.value) return
  removingAll.value = true
  try {
    for (const user of people.value.map((p) => p.user)) {
      const rows = await call('tatva_connect.smartview.api.unshare_view', {
        view: props.viewName,
        user,
      })
      people.value = rows || []
    }
  } catch (e) {
    toast.error(e.messages?.[0] || __('Could not remove these shares'))
  } finally {
    removingAll.value = false
  }
}

function onPublic(value) {
  call('tatva_connect.smartview.api.set_public', {
    view: props.viewName,
    value: value ? 1 : 0,
  })
    .then(() => emit('changed'))
    .catch((e) => {
      isPublic.value = !value // put the switch back: the server refused, so the view did not change
      toast.error(
        e.messages?.[0] || __('Could not change who this view is shared with'),
      )
    })
}
</script>
