<!-- TATVA: Campaign detail = the orchestration canvas. Loads the CRM Workflow Definition, renders it on the
     Vue Flow canvas, and — while it is a Draft — saves the nodes + canvas_json back through save_draft. A
     Draft save persists the working graph only: it mints no Version and arms nothing. Publish / Activate
     (the lifecycle) arrive with the action bar in Phase C. Node positions persist in canvas_json. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs
        :items="[
          { label: __('Campaigns'), route: { name: 'Campaigns' } },
          { label: title },
        ]"
      />
    </template>
    <template #right-header>
      <Badge
        v-if="campaign.data"
        :theme="stateTheme"
        :label="__(campaign.data.lifecycle_state || 'Draft')"
      />
      <template v-if="editable">
        <Button :label="__('Cancel')" @click="cancel" :disabled="saving" />
        <Button
          variant="solid"
          :label="__('Save')"
          iconLeft="check"
          :loading="saving"
          @click="save"
        />
      </template>
      <Button
        v-else-if="campaign.data && isDraft"
        variant="solid"
        :label="__('Edit')"
        iconLeft="edit"
        @click="editable = true"
      />
    </template>
  </LayoutHeader>

  <div class="flex flex-1 flex-col overflow-hidden">
    <div v-if="campaign.loading" class="flex flex-1 items-center justify-center">
      <LoadingIndicator class="h-6 w-6 text-ink-gray-5" />
    </div>
    <div v-else-if="campaign.data" class="flex-1">
      <CampaignCanvas
        ref="canvasRef"
        :key="canvasKey"
        :definition="campaign.data"
        :editable="editable"
      />
    </div>
  </div>
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import CampaignCanvas from '@/components/campaigns/CampaignCanvas.vue'
import {
  Breadcrumbs,
  Badge,
  Button,
  LoadingIndicator,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { ref, computed } from 'vue'

const props = defineProps({
  campaignId: { type: String, required: true },
})

// Backend method lives in tatva_connect (mirrors near_me/smartview); returns the same doc the Desk
// form edits, so the two stay in sync.
const campaign = createResource({
  url: 'tatva_connect.campaigns.api.get_campaign',
  params: { name: props.campaignId },
  cache: ['Campaign', props.campaignId],
  auto: true,
})

const title = computed(() => campaign.data?.workflow_name || props.campaignId)

// The lifecycle state drives the header: a colour-coded badge (gray=authoring, blue=frozen, green=live,
// orange=paused, red=retired) and the "editable <=> Draft" rule — Edit only shows on a Draft, mirroring the
// backend law (save_draft refuses a released Definition). Publish/Activate/etc. arrive with the full action
// bar (Phase C).
const isDraft = computed(() => (campaign.data?.lifecycle_state || 'Draft') === 'Draft')
const stateTheme = computed(
  () =>
    ({ Draft: 'gray', Published: 'blue', Active: 'green', Suspended: 'orange', Archived: 'red' })[
      campaign.data?.lifecycle_state
    ] || 'gray',
)

const editable = ref(false)
const saving = ref(false)
const canvasRef = ref(null)
const canvasKey = ref(0)

async function save() {
  if (!canvasRef.value) return
  const { nodes, canvas } = canvasRef.value.serialize()
  saving.value = true
  try {
    // Draft-only authoring save: persists the working graph + layout, mints no Version and arms nothing
    // (Save is not Publish). Publish / Activate arrive with the lifecycle action bar (Phase C).
    await call('tatva_connect.campaigns.api.save_draft', {
      name: props.campaignId,
      nodes: JSON.stringify(nodes),
      canvas_json: JSON.stringify(canvas),
    })
    toast.success(__('Draft saved'))
    editable.value = false
    await campaign.reload()
    canvasKey.value++ // remount canvas so it re-hydrates from the saved layout
  } catch (e) {
    const msgs = e?.messages?.length ? e.messages : [e?.message || __('Save failed')]
    msgs.forEach((m) => toast.error(m))
  } finally {
    saving.value = false
  }
}

async function cancel() {
  editable.value = false
  await campaign.reload()
  canvasKey.value++ // discard in-canvas moves by re-hydrating from the stored doc
}
</script>
