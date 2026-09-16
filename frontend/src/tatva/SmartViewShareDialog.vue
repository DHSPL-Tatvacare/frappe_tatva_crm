<!-- TATVA: SmartViewShareDialog — who else may open this view, via frappe's own DocShare; a share hands on the query, never rows, since every run applies the viewer's own permissions. -->
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
          <!-- The picker's own slots: `item-prefix` draws the avatar and `item-label` ticks who already has the view. -->
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
          <!-- A count heading and Remove all, so a long share list is neither a wall nor one-at-a-time. -->
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

// Fetched on open; `immediate` because the mount site is v-if, so setup is open.
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

// Both endpoints answer with the new recipient list; neither emits `changed`, since sharing leaves this person's tabs unchanged.
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

// One `unshare_view` per person (no second bulk rule); the list is taken from the last answer so concurrent removals never resurrect.
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
