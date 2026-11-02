<!-- A completed task's print preview: the page alone, as Desk draws it (frappe's Print Format and Letter Head), then frappe's PDF or print. -->
<template>
  <ResponsiveDialog v-model="show" :options="{ size: 'xl' }">
    <template #body>
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
        <!-- No scripts run inside; same origin so the Letter Head's images load with the rep's session. -->
        <iframe
          v-else-if="preview.data"
          :srcdoc="page"
          sandbox="allow-same-origin"
          class="w-full flex-1 bg-white"
          :title="__('Print preview')"
        />
        <div
          class="flex shrink-0 items-center justify-end gap-2 border-t border-outline-gray-2 px-3 py-2"
        >
          <Button
            :tooltip="__('Cancel')"
            icon="x"
            variant="ghost"
            @click="show = false"
          />
          <Button
            :tooltip="__('Print')"
            icon="printer"
            variant="subtle"
            :disabled="!preview.data"
            @click="open('/printview', { trigger_print: 1 })"
          />
          <Button
            :tooltip="__('Download PDF')"
            icon="download"
            variant="solid"
            :disabled="!preview.data"
            @click="
              open('/api/method/frappe.utils.print_format.download_pdf', {
                pdf_generator: preview.data.pdf_generator,
              })
            "
          />
        </div>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { computed } from 'vue'
import { Button, createResource } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'

const props = defineProps({ task: { type: [String, Number], required: true } })
const show = defineModel({ type: Boolean, default: false })

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

// Frappe's own print view or PDF, with the format and Letter Head the preview was drawn with.
function open(path, extra) {
  const q = new URLSearchParams({
    doctype: 'CRM Task',
    name: String(props.task),
    format: preview.data.format,
    no_letterhead: 0,
    ...(preview.data.letterhead ? { letterhead: preview.data.letterhead } : {}),
    ...extra,
  })
  window.open(`${path}?${q}`, '_blank', 'noopener')
}
</script>
