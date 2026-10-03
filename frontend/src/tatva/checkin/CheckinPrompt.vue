<template>
  <ResponsiveDialog
    v-model="open"
    :options="{ title: copy.title, message: copy.message, size: 'sm' }"
  >
    <!-- The CRM's own two-button footer (BulkDeleteLinkedDocModal): side by side on the right, stacked on mobile. -->
    <template #actions>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          v-for="action in actions"
          :key="action.label"
          class="w-full sm:w-auto"
          :label="action.label"
          :variant="action.variant"
          :loading="action.loading"
          @click="action.onClick"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
// TATVA: the one status dialog, mounted once from GlobalModals: the once-per-login ask (CI9) and the logout ask (CI10), with the CRM's own dialog footer.
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { useCheckin } from '@/tatva/checkin/useCheckin'

const {
  showPrompt,
  saving,
  setCheckin,
  dismissPrompt,
  askingLogout,
  finishLogout,
  cancelLogout,
} = useCheckin()

const copy = computed(() =>
  askingLogout.value
    ? {
        title: __('Set your status to Unavailable?'),
        message: __('Your team sees you are not working.'),
      }
    : {
        title: __('Set your status to Active?'),
        message: __('Your team sees you are working.'),
      },
)

const actions = computed(() =>
  askingLogout.value
    ? [
        { label: __('Log out'), onClick: () => finishLogout(false) },
        {
          label: __('Set Unavailable and log out'),
          variant: 'solid',
          loading: saving.value,
          onClick: () => finishLogout(true),
        },
      ]
    : [
        { label: __('Not now'), onClick: dismissPrompt },
        {
          label: __('Set Active'),
          variant: 'solid',
          loading: saving.value,
          onClick: () => setCheckin('Active').catch(() => {}),
        },
      ],
)

// Closing the login ask counts as "Not now"; closing the logout ask cancels the logout.
const open = computed({
  get: () => askingLogout.value || showPrompt.value,
  set: (v) => {
    if (v || saving.value) return
    if (askingLogout.value) cancelLogout()
    else if (showPrompt.value) dismissPrompt()
  },
})
</script>
