<!--
  TATVA: SmartViewShareDialog — who else may open this Smart View.

  It is frappe's OWN sharing (DocShare) end to end: the backend calls `frappe.share.add/remove`, and this
  only picks a user and lists who is already on it. No share table, no share concept, and no permission
  rule invented here.

  THE THING WORTH SAYING OUT LOUD, and it is said in the dialog too: sharing a view shares a QUESTION,
  never an answer. Every run still applies the viewer's own permissions, so two people opening one shared
  view see different rows. That is why this is safe to hand out across business lines.

  "Everyone" is the operator-only switch (crm's own `public()` rule): a public view belongs to nobody, so
  making one public clears its owner. It is kept visually apart from the per-person list because it is a
  different kind of act.

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
        <!-- Everyone. Operator-only, and deliberately first: it is the biggest thing this dialog does. -->
        <div
          v-if="canMakePublic"
          class="flex items-start justify-between gap-3 rounded-lg bg-surface-gray-2 p-3"
        >
          <div class="min-w-0">
            <div class="text-base font-medium text-ink-gray-8">
              {{ __('Share with everyone in this grain') }}
            </div>
            <p class="mt-0.5 text-p-sm text-ink-gray-5">
              {{
                __(
                  'A public view has no owner and appears for everyone entitled to its business line.',
                )
              }}
            </p>
          </div>
          <Switch v-model="isPublic" @update:modelValue="onPublic" />
        </div>

        <div>
          <div class="mb-1.5 text-base text-ink-gray-5">
            {{ __('Share with a person') }}
          </div>
          <Link
            class="form-control"
            value=""
            doctype="User"
            :placeholder="__('Search a user')"
            :filters="{ ignore_user_type: 1 }"
            :hideMe="true"
            @change="(user) => user && addUser(user)"
          />
        </div>

        <div v-if="people.length" class="flex flex-wrap gap-1.5">
          <div
            v-for="p in people"
            :key="p.user"
            class="flex items-center rounded-full border border-outline-gray-1 bg-surface-modal p-0.5 text-sm text-ink-gray-6"
          >
            <UserAvatar :user="p.user" size="sm" />
            <span class="ml-1">{{ getUser(p.user).full_name || p.user }}</span>
            <Button
              variant="ghost"
              class="!size-4 m-1 rounded-full"
              :tooltip="__('Remove')"
              @click="removeUser(p.user)"
            >
              <template #icon
                ><FeatherIcon name="x" class="h-3 w-3"
              /></template>
            </Button>
          </div>
        </div>
        <p v-else class="text-p-sm text-ink-gray-5">
          {{ __('Not shared with anyone yet.') }}
        </p>

        <!-- The sentence that stops someone thinking this hands over data. -->
        <p
          class="border-t border-outline-gray-1 pt-3 text-p-sm text-ink-gray-5"
        >
          {{
            __(
              'Sharing a view shares the question, not the records: everyone still sees only the rows they are allowed to see.',
            )
          }}
        </p>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { Button, FeatherIcon, Switch, call, toast } from 'frappe-ui'
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

const { getUser, isManager } = usersStore()

// Who may hand a view to EVERYONE. The same role helper the native list uses for its manager-only
// affordances (ViewControls.vue:55); the server enforces operator-only on `set_public` regardless, so
// this only decides whether the control is drawn. It lives in the dialog rather than the list so the
// list keeps its single store dependency — a second one broke its mount in tests, which is exactly the
// coupling this avoids.
const canMakePublic = computed(() => Boolean(isManager()))
const people = ref([])
const isPublic = ref(props.isStandard)

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

function addUser(user) {
  if (people.value.some((p) => p.user === user)) return
  call('tatva_connect.smartview.api.share_view', { view: props.viewName, user })
    .then((rows) => {
      people.value = rows || []
      emit('changed')
    })
    .catch((e) =>
      toast.error(e.messages?.[0] || __('Could not share this view')),
    )
}

function removeUser(user) {
  call('tatva_connect.smartview.api.unshare_view', {
    view: props.viewName,
    user,
  })
    .then((rows) => {
      people.value = rows || []
      emit('changed')
    })
    .catch((e) =>
      toast.error(e.messages?.[0] || __('Could not remove this share')),
    )
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
