<template>
  <!-- TATVA: ResponsiveDialog + named slots so the linked-docs list scrolls INTERNALLY (max-h) with a
       pinned title and footer, instead of the whole modal growing past the viewport with many linked
       docs. Replaces the retired delete_modal_fit.js MutationObserver height hijack; mirrors TaskModal's
       contained-body pattern. Free mobile bottom-sheet via ResponsiveDialog. Script logic unchanged. -->
  <ResponsiveDialog v-model="show" :options="{ size: 'xl' }">
    <template #body-title>
      <h3 class="text-lg font-semibold text-ink-gray-9">
        {{
          linkedDocs?.length == 0
            ? __('Delete')
            : __('Delete or unlink linked documents')
        }}
      </h3>
    </template>

    <template #body-content>
      <div class="flex flex-col gap-4 overflow-y-auto pr-0.5 sm:max-h-[60dvh]">
        <div v-if="linkedDocs?.length > 0">
          <span class="text-ink-gray-5 text-base">
            {{
              __('These documents are linked to this record. Delete takes them with it; Unlink & Delete keeps them.')
            }}
          </span>
          <LinkedDocsListView
            class="mt-4"
            :rows="linkedDocs"
            :columns="[
              { label: 'Document', key: 'title', width: '19rem' },
              { label: 'Master', key: 'reference_doctype', width: '12rem' },
            ]"
            :linkedDocsResource="linkedDocsResource"
            :unlinkLinkedDoc="unlinkLinkedDoc"
            @selectionsChanged="
              (selections) => viewControls.updateSelections(selections)
            "
          />
        </div>
        <div v-else class="text-ink-gray-5 text-base">
          {{
            __('Are you sure you want to delete {0} - {1}?', [
              props.doctype,
              props.docname,
            ])
          }}
        </div>
      </div>
    </template>

    <template #actions>
      <div class="flex flex-row-reverse gap-2">
        <Button
          variant="solid"
          theme="red"
          icon-left="trash-2"
          :label="__('Delete')"
          @click="queueDelete(true)"
        />
        <Button
          v-if="linkedDocs?.length > 0"
          variant="subtle"
          theme="gray"
          icon-left="unlock"
          :label="__('Unlink & Delete')"
          @click="queueDelete(false)"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { createResource, call, toast } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue' // TATVA: contained-body modal (see template)
import { useBulkJob } from '@/tatva/useBulkJob' // TATVA: the shared queued-action reader
import { useRouter, useRoute } from 'vue-router'
import { computed, ref } from 'vue'

const show = defineModel({ type: Boolean })
const router = useRouter()
const route = useRoute()
const props = defineProps({
  name: { type: String, required: true },
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  reload: { type: Function, default: null },
})
const viewControls = ref({
  selections: [],
  updateSelections: (selections) => {
    viewControls.value.selections = Array.from(selections || [])
  },
})

const { deleteRecords } = useBulkJob()

const linkedDocsResource = createResource({
  url: 'crm.api.doc.get_linked_docs_of_document',
  params: {
    doctype: props.doctype,
    docname: props.docname,
  },
  auto: true,
  validate(params) {
    if (!params?.doctype || !params?.docname) {
      return false
    }
  },
})

const linkedDocs = computed(() => {
  return (
    linkedDocsResource.data?.map((doc) => ({
      id: doc.reference_docname,
      ...doc,
    })) || []
  )
})

// TATVA: ONE flag for "a mutation is in flight", read by every action in this modal — a second ref per
// action was two names for one fact. It only feeds the frappe-ui Button's own `loading`, which renders
// the spinner and disables the button, so nothing here draws or times an indicator of its own.
const busy = ref(false)

const unlinkLinkedDoc = (doc) => {
  let selectedDocs = []
  if (viewControls.value.selections.length > 0) {
    Array.from(viewControls.value.selections).forEach((selection) => {
      const docData = linkedDocs.value.find((d) => d.id == selection)
      selectedDocs.push({
        doctype: docData.reference_doctype,
        docname: docData.reference_docname,
      })
    })
  } else {
    selectedDocs = linkedDocs.value.map((doc) => ({
      doctype: doc.reference_doctype,
      docname: doc.reference_docname,
    }))
  }

  // TATVA: awaited, and the round trip is flagged. It was fire-and-forget: the modal sat open with the
  // button still live while the server worked, so a slow unlink read as a dead click and a second click
  // sent the whole thing twice.
  busy.value = true
  return call('crm.api.doc.remove_linked_doc_reference', {
    items: selectedDocs,
    remove_contact: props.doctype == 'Contact',
    delete: doc.delete,
  })
    .then(() => {
      linkedDocsResource.reload()
      viewControls.value.updateSelections([])
    })
    // TATVA: an unlink can be refused too, and it was failing as silently as the delete below.
    .catch((e) => toast.error(e?.messages?.[0] || __('Could not unlink')))
    .finally(() => (busy.value = false))
}

// TATVA: the ONE delete door, shared with the list's own delete — queued, because the cascade over this
// record's tasks, calls and messages is not the rep's to wait on.
const queueDelete = (deleteLinked) => {
  show.value = false
  deleteRecords(props.doctype, [props.docname], deleteLinked, (result) => {
    if (result.status === 'Error' || result.failed) return
    // Only move the rep who is still looking at the record that went; a job answering long after they
    // moved on must not yank the page out from under whatever they are doing now.
    if (route.path.includes(props.docname)) router.push({ name: props.name })
    props?.reload?.()
  })
}
</script>
