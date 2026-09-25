<!-- TATVA: one Task Form — the builder for a single CRM Task Type, on the Workflows detail lifecycle. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex items-center gap-2">
        <Breadcrumbs
          :items="[
            { label: __('Task Forms'), route: { name: 'Task Forms' } },
            { label: title },
          ]"
        />
        <!-- The state HUGS the name, as the Workflows state does. -->
        <Badge
          v-if="doc"
          variant="subtle"
          :theme="doc.enabled ? 'green' : 'gray'"
          :label="doc.enabled ? __('Enabled') : __('Disabled')"
        />
      </div>
    </template>
    <template #right-header>
      <span v-if="doc" class="hidden text-xs text-ink-gray-5 sm:inline">
        {{ grainLabel(doc) }}
      </span>
    </template>
  </LayoutHeader>

  <div class="flex flex-1 flex-col overflow-hidden">
    <div v-if="form.loading && !form.data" class="flex flex-1 items-center justify-center">
      <LoadingIndicator class="h-6 w-6 text-ink-gray-5" />
    </div>
    <div
      v-else-if="form.error"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-ink-gray-5"
    >
      <div>{{ form.error.messages?.[0] || form.error.message }}</div>
      <Button :label="__('Retry')" @click="form.reload()" />
    </div>
    <Tabs
      v-else-if="form.data"
      v-model="tabIndex"
      :tabs="tabs"
      class="flex flex-1 flex-col overflow-hidden [&_[role='tab']]:px-0 [&_[role='tablist']]:px-5 [&_[role='tablist']]:gap-7.5 [&_[role='tabpanel']:not([hidden])]:flex [&_[role='tabpanel']:not([hidden])]:grow [&_[role='tabpanel']]:overflow-hidden"
    >
      <template #tab-panel="{ tab }">
        <div class="flex-1 overflow-y-auto p-5">
          <FieldLayoutEditor
            v-if="tab.name === 'design'"
            :modelValue="layout"
            doctype="CRM Task Type"
            readonly
          />
          <FormRules
            v-else-if="tab.name === 'rules'"
            :rules="doc.rules"
            :schema="doc.schema"
            :targets="form.data.targets"
          />
          <!-- `context` is the standalone mode: FieldLayout renders `data` and fetches no document of its own. -->
          <FieldLayout
            v-else
            :tabs="settings"
            :data="doc"
            doctype="CRM Task Type"
            :context="{}"
          />
        </div>
      </template>
    </Tabs>
  </div>
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import FieldLayoutEditor from '@/components/FieldLayoutEditor.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import FormRules from './FormRules.vue'
import { bindLayout } from './layoutTree'
import { grainLabel } from '@/tatva/useEntitledGrains'
import { Badge, Breadcrumbs, Button, LoadingIndicator, Tabs, createResource } from 'frappe-ui'
import { computed, ref } from 'vue'

const props = defineProps({ formName: { type: String, required: true } })

// One call for the whole page and no cache key: two authors on one form must never open a stale copy.
const form = createResource({
  url: 'tatva_connect.taxonomy.doctype.crm_task_type.crm_task_type.builder_doc',
  makeParams: () => ({ task_type: props.formName }),
  auto: true,
})

const doc = computed(() => form.data?.doc)
const title = computed(() => doc.value?.type_name || props.formName)
const layout = computed(() => bindLayout(form.data.layout, doc.value.schema))

// View mode: every setting reads as it is stored; editing arrives with the lifecycle.
const settings = computed(() =>
  form.data.settings.map((tab) => ({
    ...tab,
    sections: tab.sections.map((section) => ({
      ...section,
      columns: (section.columns || []).map((column) => ({
        ...column,
        fields: column.fields.map((f) => ({ ...f, read_only: 1 })),
      })),
    })),
  })),
)

const tabIndex = ref(0)
const tabs = [
  { name: 'design', label: __('Design') },
  { name: 'rules', label: __('Rules') },
  { name: 'settings', label: __('Settings') },
]
</script>
