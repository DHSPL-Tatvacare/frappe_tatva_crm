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
        <!-- TATVA: the native Button `loading` pair kills the double submit while the job is being queued. -->
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

// TATVA: routed through the shared list-action seam, which always queues; `onComplete` reports what the
// job actually did, in the seam's own `{total, succeeded, failed, failed_names}` shape.
const busy = ref(false)

const deleteDocs = async () => {
  if (busy.value) return
  busy.value = true
  const { deleteRecords } = useBulkJob()
  try {
    await deleteRecords(
      props.doctype,
      Array.from(props.items),
      confirmDeleteInfo.value.delete,
      () => props.reload(),
    )
  } catch {
    return // `deleteRecords` has already said why
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
