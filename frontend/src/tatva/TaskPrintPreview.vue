<!-- A completed task's print preview: the page alone, as Desk draws it (frappe's Print Format and Letter Head), then frappe's PDF or print. -->
<template>
  <ResponsiveDialog
    v-model="show"
    :options="{ title: __('Print'), size: 'xl' }"
  >
    <template #body-content>
      <div class="flex h-[60dvh] flex-col sm:h-[75dvh]">
        <EmptyState
          v-if="preview.loading"
          name="Preview"
          :title="__('Loading preview…')"
          description=""
          icon="printer"
        />
        <EmptyState
          v-else-if="preview.error"
          name="Preview"
          :title="__('Could not load the preview')"
          :description="
            preview.error.messages?.[0] || __('Try again in a moment.')
          "
          icon="printer"
        />
        <!-- No scripts run inside; same origin so the Letter Head's images load with the rep's session, modals so it can print. -->
        <iframe
          v-else-if="preview.data"
          ref="frame"
          :srcdoc="page"
          sandbox="allow-same-origin allow-modals"
          class="w-full flex-1 bg-white"
          :title="__('Print preview')"
        />
      </div>
    </template>
    <template #actions>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          class="w-full sm:w-auto"
          variant="subtle"
          :label="__('Cancel')"
          @click="show = false"
        />
        <Button
          class="w-full sm:w-auto"
          variant="subtle"
          icon-left="printer"
          :label="__('Print')"
          :disabled="!preview.data"
          @click="frame.contentWindow.print()"
        />
        <Button
          class="w-full sm:w-auto"
          variant="solid"
          icon-left="download"
          :label="__('Download PDF')"
          :disabled="!preview.data"
          @click="download"
        />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, createResource } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'

const props = defineProps({ task: { type: [String, Number], required: true } })
const show = defineModel({ type: Boolean, default: false })
const frame = ref(null)

// Mounted per open (`v-if` in the parent), so this is one request per preview.
const preview = createResource({
  url: 'tatva_connect.activity.task_print.preview',
  method: 'GET',
  params: { task: String(props.task) },
  auto: true,
})

// The page alone: frappe's `.print-format`, without the grey `.print-format-gutter` Desk sets it on.
const page = computed(
  () =>
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${preview.data.style || ''}</style>` +
    `<style>body{margin:0;background:white}.print-format{border-radius:0}</style></head>` +
    `<body><div class="print-format">${preview.data.html}</div></body></html>`,
)

// frappe's own PDF, saved in this tab's session (no new window, so a home-screen app keeps its login); the task's grain picks the Letter Head server-side.
function download() {
  const q = new URLSearchParams({
    doctype: 'CRM Task',
    name: String(props.task),
    format: preview.data.format,
    no_letterhead: 0,
    pdf_generator: preview.data.pdf_generator,
  })
  const a = document.createElement('a')
  a.href = `/api/method/frappe.utils.print_format.download_pdf?${q}`
  a.download = ''
  a.click()
}
</script>
