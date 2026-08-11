<!-- TATVA: the API response mapping surface — response path → run variable. -->
<template>
  <div>
    <Button
      :label="summary"
      iconLeft="edit-3"
      class="w-full sm:w-auto"
      :disabled="disabled"
      @click="open = true"
    />

    <ResponsiveDialog v-model="open" :options="{ size: '2xl' }">
      <template #body-title>
        <h3 class="text-lg font-semibold text-ink-gray-9">{{ __('Capture from the response') }}</h3>
      </template>

      <template #body-content>
        <div class="flex flex-col gap-4 overflow-y-auto sm:max-h-[60dvh]">
          <p class="text-p-sm text-ink-gray-6">
            {{
              __(
                'The response is available as status, ok, error and body. Name a path and the variable it lands in — downstream nodes read that variable like any other.',
              )
            }}
          </p>

          <div class="flex flex-col gap-2">
            <div
              v-for="(row, i) in rows"
              :key="i"
              class="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto]"
            >
              <FormControl
                type="text"
                :placeholder="__('body.data.id')"
                :modelValue="row.path"
                :disabled="disabled"
                @update:modelValue="(v) => update(i, 'path', v)"
              />
              <span class="hidden text-ink-gray-5 sm:block">→</span>
              <FormControl
                type="text"
                :placeholder="__('patient_id')"
                :modelValue="row.variable"
                :disabled="disabled"
                @update:modelValue="(v) => update(i, 'variable', v)"
              />
              <Button
                variant="ghost"
                icon="x"
                :label="''"
                :disabled="disabled"
                @click="removeAt(i)"
              />
            </div>

            <p v-if="!rows.length" class="text-p-sm text-ink-gray-5">
              {{ __('Nothing captured yet. The call still runs; nothing is kept from its answer.') }}
            </p>
          </div>

          <div>
            <Button
              variant="ghost"
              iconLeft="plus"
              :label="__('Capture a value')"
              class="!text-ink-gray-6"
              :disabled="disabled"
              @click="add"
            />
          </div>

          <!-- The real answer, so a path is CLICKED rather than typed from memory. -->
          <div v-if="preview" class="rounded border border-outline-gray-2 bg-surface-gray-1 p-3">
            <div class="mb-2 flex items-center gap-2">
              <div class="text-xs font-medium text-ink-gray-7">{{ __('The answer') }}</div>
              <div class="flex-1" />
              <Button
                :label="__('Test call')"
                iconLeft="play"
                :loading="probe.loading"
                :disabled="disabled"
                @click="probe.fetch()"
              />
            </div>

            <FormControl
              type="textarea"
              :rows="3"
              :placeholder="__('…or paste a sample response here')"
              :modelValue="pasted"
              @update:modelValue="(v) => (pasted = v)"
            />

            <p v-if="probe.data && probe.data.armed === false" class="mt-2 text-p-sm text-ink-gray-5">
              {{ __('Automation is switched off on this site, so nothing was sent.') }}
            </p>
            <p v-else-if="probe.data?.lead" class="mt-2 text-p-sm text-ink-gray-5">
              {{ __('Built from lead {0} — status {1}', [probe.data.lead, probe.data.status]) }}
            </p>
            <ErrorMessage v-if="probe.error" class="mt-2" :message="probe.error" />

            <div v-if="tree" class="mt-2 max-h-56 overflow-auto rounded bg-surface-white p-2">
              <Tree
                :node="tree"
                nodeKey="path"
                :options="{ rowHeight: '22px', indentWidth: '14px', showIndentationGuides: true, defaultCollapsed: false }"
              >
                <template #label="{ node, hasChildren }">
                  <button
                    class="flex min-w-0 items-baseline gap-1.5 text-left"
                    :class="hasChildren ? '' : 'group'"
                    :title="node.path"
                    :disabled="hasChildren"
                    @click="capture(node.path)"
                  >
                    <span class="shrink-0 font-mono text-xs text-ink-gray-7">{{ node.label }}</span>
                    <span
                      v-if="!hasChildren"
                      class="truncate text-xs text-ink-gray-5 group-hover:text-ink-blue-3 group-hover:underline"
                    >{{ node.preview }}</span>
                  </button>
                </template>
              </Tree>
            </div>
            <p v-else class="mt-2 text-p-sm text-ink-gray-5">
              {{ __('Press Test call, or paste a response, then click any value to capture it.') }}
            </p>
          </div>

          <div v-else class="rounded border border-outline-gray-2 bg-surface-gray-1 p-3">
            <div class="mb-1 text-xs font-medium text-ink-gray-7">{{ __('Examples') }}</div>
            <ul class="flex flex-col gap-1 text-p-sm text-ink-gray-6">
              <li><code>status</code> — {{ __('the HTTP status code') }}</li>
              <li><code>ok</code> — {{ __('1 when the call succeeded') }}</li>
              <li><code>body.data.id</code> — {{ __('a field inside the JSON body') }}</li>
              <li><code>body.items.0.name</code> — {{ __('the first item of a list') }}</li>
            </ul>
          </div>
        </div>
      </template>

      <template #actions>
        <Button
          variant="solid"
          class="w-full sm:w-auto"
          :label="__('Done')"
          @click="open = false"
        />
      </template>
    </ResponsiveDialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { FormControl, Button, ErrorMessage, Tree, createResource } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  // Declared on the field: the method that fetches a real answer. Absent means this control cannot preview.
  preview: { type: Object, default: null },
  // Its arguments, already resolved from the sibling fields the declaration named.
  previewArgs: { type: Object, default: () => ({}) },
})
const model = defineModel({ type: Array, default: () => [] })

const open = ref(false)
const pasted = ref('')
const rows = computed(() => model.value || [])

// `auto: false` — an outbound call happens because the author asked for one, never because a panel opened.
const probe = createResource({
  url: props.preview?.method || '',
  makeParams: () => ({ ...props.previewArgs }),
})

// A JSON value as the node shape frappe-ui's Tree already renders. A list index is a path segment like
// any key, so `body.items.0.name` is exactly what the runtime's own `_dig` walks.
function toNode(label, value, path) {
  const branch = value !== null && typeof value === 'object'
  const pairs = branch ? (Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value)) : []
  return {
    label,
    path,
    preview: branch ? '' : String(value),
    children: pairs.map(([k, v]) => toNode(k, v, path ? `${path}.${k}` : k)),
  }
}

// A pasted sample wins while it parses: the author reaches for it precisely when the call cannot be made.
const answer = computed(() => {
  const text = (pasted.value || '').trim()
  if (text) {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  if (!probe.data || probe.data.armed === false) return null
  // The same shape a run reads — status, ok, error and body — so a clicked path is the runtime's path.
  const { status, ok, error, body } = probe.data
  return { status, ok, error, body }
})

const tree = computed(() => (answer.value === null ? null : toNode(__('response'), answer.value, '')))

// Clicking a value fills the path; naming it is the author's, because the name is what downstream reads.
function capture(path) {
  write([...rows.value, { path, variable: '' }])
}

const summary = computed(() => {
  const named = rows.value.filter((r) => r.variable).length
  if (!named) return __('Capture from the response')
  return named === 1 ? __('1 value captured') : __('{0} values captured', [named])
})

// Written whole each time, or the inspector's JSON and this control disagree.
function write(next) {
  model.value = next
}

function add() {
  write([...rows.value, { path: '', variable: '' }])
}

function removeAt(i) {
  write(rows.value.filter((_, j) => j !== i))
}

function update(i, key, value) {
  const next = rows.value.map((row, j) => (j === i ? { ...row, [key]: value } : row))
  write(next)
}
</script>
