<template>
  <!-- TATVA: ResponsiveDialog + named slots so the linked-docs list scrolls INTERNALLY (max-h) with a
       pinned title and footer, instead of the whole modal growing past the viewport with many linked
       docs. Replaces the retired delete_modal_fit.js MutationObserver height hijack; mirrors TaskModal's
       contained-body pattern. Free mobile bottom-sheet via ResponsiveDialog. Script logic unchanged. -->
  <ResponsiveDialog v-model="show" :options="{ size: 'xl' }">
    <template #body-title>
      <h3 class="text-lg font-semibold text-ink-gray-9">
        {{
          confirmDeleteInfo.show
            ? confirmDeleteInfo.title
            : linkedDocs?.length == 0
              ? __('Delete')
              : __('Delete or unlink linked documents')
        }}
      </h3>
    </template>

    <template #body-content>
      <div class="flex flex-col gap-4 overflow-y-auto pr-0.5 sm:max-h-[60vh]">
        <template v-if="!confirmDeleteInfo.show">
          <div v-if="linkedDocs?.length > 0">
            <span class="text-ink-gray-5 text-base">
              {{
                __('Delete or unlink these linked documents before deleting this document')
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
        </template>
        <div v-else class="text-ink-gray-5 text-base">
          {{ confirmDeleteInfo.message }}
        </div>
      </div>
    </template>

    <template #actions>
      <div v-if="!confirmDeleteInfo.show" class="flex flex-row-reverse gap-2">
        <Button
          v-if="linkedDocs?.length > 0"
          :label="
            viewControls?.selections?.length == 0
              ? __('Delete All')
              : __('Delete {0} Item(s)', [viewControls?.selections?.length])
          "
          theme="red"
          variant="solid"
          icon-left="trash-2"
          @click="confirmDelete()"
        />
        <Button
          v-if="linkedDocs?.length > 0"
          :label="
            viewControls?.selections?.length == 0
              ? __('Unlink All')
              : __('Unlink {0} Item(s)', [viewControls?.selections?.length])
          "
          variant="subtle"
          theme="gray"
          icon-left="unlock"
          @click="confirmUnlink()"
        />
        <Button
          v-if="linkedDocs?.length == 0"
          variant="solid"
          icon-left="trash-2"
          :label="__('Delete')"
          :loading="isDealCreating"
          theme="red"
          @click="deleteDoc()"
        />
      </div>
      <div v-else class="flex justify-end gap-2">
        <Button variant="ghost" @click="cancel()">
          {{ __('Cancel') }}
        </Button>
        <Button
          variant="solid"
          :label="confirmDeleteInfo.title"
          theme="red"
          @click="removeDocLinks()"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { createResource, call } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue' // TATVA: contained-body modal (see template)
import { useRouter } from 'vue-router'
import { computed, ref } from 'vue'

const show = defineModel({ type: Boolean })
const router = useRouter()
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

const confirmDeleteInfo = ref({
  show: false,
  title: '',
})

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

const cancel = () => {
  confirmDeleteInfo.value.show = false
  viewControls.value.updateSelections([])
}

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

  call('crm.api.doc.remove_linked_doc_reference', {
    items: selectedDocs,
    remove_contact: props.doctype == 'Contact',
    delete: doc.delete,
  }).then(() => {
    linkedDocsResource.reload()
    confirmDeleteInfo.value = {
      show: false,
      title: '',
    }
  })
}

const confirmDelete = () => {
  const items =
    viewControls.value.selections.length == 0
      ? 'all'
      : viewControls.value.selections.length
  confirmDeleteInfo.value = {
    show: true,
    title: __('Delete Linked Item'),
    message: __('Are you sure you want to delete {0} linked item(s)?', [items]),
    delete: true,
  }
}

const confirmUnlink = () => {
  const items =
    viewControls.value.selections.length == 0
      ? 'all'
      : viewControls.value.selections.length
  confirmDeleteInfo.value = {
    show: true,
    title: __('Unlink Linked Item'),
    message: __('Are you sure you want to unlink {0} linked item(s)?', [items]),
    delete: false,
  }
}

const removeDocLinks = () => {
  unlinkLinkedDoc({
    reference_doctype: props.doctype,
    reference_docname: props.docname,
    delete: confirmDeleteInfo.value.delete,
  })
  viewControls.value.updateSelections([])
}

const deleteDoc = async () => {
  await call('frappe.client.delete', {
    doctype: props.doctype,
    name: props.docname,
  })
  router.push({ name: props.name })
  props?.reload?.()
}
</script>
