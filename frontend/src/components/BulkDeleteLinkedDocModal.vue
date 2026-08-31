<template>
  <Dialog v-model="show" :options="{ size: 'xl' }">
    <template #body>
      <div
        v-if="!confirmDeleteInfo.show"
        class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6"
      >
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h3 class="text-2xl leading-6 text-ink-gray-9 font-semibold">
              {{ __('Delete') }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button variant="ghost" icon="x" @click="show = false" />
          </div>
        </div>
        <div>
          <div class="text-ink-gray-5 text-base">
            {{
              __('Are you sure you want to delete {0} items?', [
                props.items?.length,
              ])
            }}
          </div>
        </div>
      </div>
      <div v-if="!confirmDeleteInfo.show" class="px-4 pb-7 pt-0 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            :label="__('Delete {0} items', [props.items.length])"
            icon-left="trash-2"
            variant="solid"
            theme="red"
            @click="confirmDelete()"
          />
          <Button
            :label="__('Unlink & Delete {0} items', [props.items.length])"
            icon-left="unlock"
            variant="solid"
            @click="confirmUnlink()"
          />
        </div>
      </div>
      <div
        v-if="confirmDeleteInfo.show"
        class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6"
      >
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h3 class="text-2xl leading-6 text-ink-gray-9 font-semibold">
              {{ __('Delete') }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button variant="ghost" icon="x" @click="show = false" />
          </div>
        </div>
        <div>
          <div class="text-ink-gray-5 text-base">
            {{
              confirmDeleteInfo.delete
                ? __(
                    'This will delete selected items and items linked to it, are you sure?',
                  )
                : __(
                    'This will delete selected items and unlink linked items to it, are you sure?',
                  )
            }}
          </div>
        </div>
      </div>
      <div v-if="confirmDeleteInfo.show" class="px-4 pb-7 pt-0 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            :label="
              confirmDeleteInfo.delete ? __('Delete') : __('Unlink & Delete')
            "
            :icon-left="confirmDeleteInfo.delete ? 'trash-2' : 'unlock'"
            variant="solid"
            theme="red"
            @click="deleteDocs()"
          />
          <Button
            :label="__('Cancel')"
            variant="subtle"
            @click="confirmDeleteInfo.show = false"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { toast } from 'frappe-ui'
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
const deleteDocs = async () => {
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
  }
  confirmDeleteInfo.value = {
    show: false,
    title: '',
  }
  show.value = false
}
</script>
