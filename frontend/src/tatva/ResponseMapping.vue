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
        <div class="flex flex-col gap-4 overflow-y-auto sm:max-h-[60vh]">
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

          <div class="rounded border border-outline-gray-2 bg-surface-gray-1 p-3">
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
import { FormControl, Button } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'

defineProps({
  disabled: { type: Boolean, default: false },
})
const model = defineModel({ type: Array, default: () => [] })

const open = ref(false)
const rows = computed(() => model.value || [])

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
