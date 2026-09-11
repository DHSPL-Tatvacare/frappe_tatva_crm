<template>
  <!-- TATVA: named slots, mirroring DeleteLinkedDocModal (its singular twin). The old markup drew its own
       <h3> and close X inside #body, which on mobile stacked a second title and a second cross under the
       sheet's own sticky header, and left the actions to scroll away with the body. Buttons stack full
       width under 640px (CallLogDetailModal's row idiom) — two "... N items" labels never fit a phone. -->
  <ResponsiveDialog v-model="show" :options="{ size: 'xl' }">
    <template #body-title>
      <h3 class="text-lg font-semibold text-ink-gray-9">
        {{ confirmDeleteInfo.show ? confirmDeleteInfo.title : __('Delete') }}
      </h3>
    </template>

    <template #body-content>
      <div class="text-ink-gray-5 text-base">
        <template v-if="!confirmDeleteInfo.show">
          {{
            __('Are you sure you want to delete {0} items?', [
              props.items?.length,
            ])
          }}
        </template>
        <template v-else>
          {{
            confirmDeleteInfo.delete
              ? __(
                  'This will delete selected items and items linked to it, are you sure?',
                )
              : __(
                  'This will delete selected items and unlink linked items to it, are you sure?',
                )
          }}
        </template>
      </div>
    </template>

    <template #actions>
      <div
        v-if="!confirmDeleteInfo.show"
        class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      >
        <Button
          class="w-full sm:w-auto"
          :label="__('Unlink & Delete {0} items', [props.items.length])"
          icon-left="unlock"
          variant="solid"
          @click="confirmUnlink()"
        />
        <Button
          class="w-full sm:w-auto"
          :label="__('Delete {0} items', [props.items.length])"
          icon-left="trash-2"
          variant="solid"
          theme="red"
          @click="confirmDelete()"
        />
      </div>
      <div
        v-else
        class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      >
        <Button
          class="w-full sm:w-auto"
          :label="__('Cancel')"
          variant="subtle"
          :disabled="busy"
          @click="confirmDeleteInfo.show = false"
        />
        <!-- TATVA: the native Button `loading` pair (it renders the spinner AND disables itself, so the
             same prop kills the double submit). Under 20 rows the seam deletes INLINE, so this await is
             the deletion itself and the sheet sat frozen for its whole duration with the button still
             live; at or above 20 it queues and returns at once, where the same flag reads as a blink. -->
        <Button
          class="w-full sm:w-auto"
          :label="
            confirmDeleteInfo.delete ? __('Delete') : __('Unlink & Delete')
          "
          :icon-left="confirmDeleteInfo.delete ? 'trash-2' : 'unlock'"
          variant="solid"
          theme="red"
          :loading="busy"
          :loading-text="__('Deleting…')"
          @click="deleteDocs()"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { toast } from 'frappe-ui'
// TATVA: the mobile tag swap (C.22) — desktop stays the stock Dialog byte for byte.
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { useBulkJob } from '@/tatva/useBulkJob'
import { ref } from 'vue'

const show = defineModel({ type: Boolean })
const props = defineProps({
  doctype: { type: String, required: true },
  items: { type: Array, required: true },
  reload: { type: Function, required: true },
})

const confirmDeleteInfo = ref({
  show: false,
  title: '',
  message: '',
  delete: false,
})

const confirmDelete = () => {
  confirmDeleteInfo.value = {
    show: true,
    title: __('Delete'),
    message: __('Are you sure you want to delete {0} linked doc(s)?', [
      props.items.length,
    ]),
    delete: true,
  }
}

const confirmUnlink = () => {
  confirmDeleteInfo.value = {
    show: true,
    title: __('Unlink'),
    message: __('Are you sure you want to unlink {0} linked doc(s)?', [
      props.items.length,
    ]),
    delete: false,
  }
}

// TATVA: routed through the shared bulk-action seam — under 20 items (or the feature off) this still
// resolves inline, ≥20 it queues, and either way `onComplete` below reports what actually happened
// instead of assuming success. The seam's own result shape is `{total, succeeded, failed, failed_names}`,
// not `delete_bulk_docs`'s `{queued, deleted, failed}`, so the toast branches read the new field names.
// TATVA: the same one-flag shape as DeleteLinkedDocModal, feeding the Button's own `loading`.
const busy = ref(false)

const deleteDocs = async () => {
  if (busy.value) return
  busy.value = true
  const { runOrQueue } = useBulkJob()
  try {
    await runOrQueue(
      'Bulk Delete',
      props.doctype,
      props.items,
      { delete_linked: confirmDeleteInfo.value.delete },
      (result) => {
        props.reload()
        if (result.status === 'Error' || result.failed) {
          toast.error(
            __(
              '{0} of {1} could not be deleted — still linked to other documents',
              [result.failed, result.total],
            ),
          )
        } else {
          toast.success(
            __('Deleted {0} items', [result.succeeded ?? result.total]),
          )
        }
      },
    )
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not delete'))
    return
  } finally {
    busy.value = false
  }
  confirmDeleteInfo.value = {
    show: false,
    title: '',
  }
  show.value = false
}
</script>
