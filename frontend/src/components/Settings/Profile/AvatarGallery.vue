<template>
  <Dialog
    v-model="show"
    :options="{ title: __('Choose your photo'), size: '3xl' }"
  >
    <template #body-content>
      <div class="flex items-start justify-between pb-4">
        <p class="text-p-sm text-ink-gray-6">
          {{ __('Pick an avatar below, or upload your own photo.') }}
        </p>
        <FileUploader
          :validateFile="validateIsImageFile"
          :upload-args="{
            doctype: 'User',
            docname: sessionUser,
            fieldname: 'user_image',
          }"
          @success="(file) => choose(file.file_url)"
        >
          <template #default="{ openFileSelector, uploading, error }">
            <div class="flex flex-col items-end gap-1">
              <Button
                :loading="uploading"
                iconLeft="upload"
                :label="__('Upload photo')"
                @click="openFileSelector"
              />
              <ErrorMessage :message="error" />
            </div>
          </template>
        </FileUploader>
      </div>

      <!-- three states: loading, loaded-with-avatars, or failed/empty -->
      <div v-if="loading" class="flex h-40 items-center justify-center">
        <LoadingIndicator class="size-5 text-ink-gray-4" />
      </div>
      <div
        v-else-if="series.length"
        class="max-h-[60vh] space-y-6 overflow-y-auto pr-1"
      >
        <div v-for="s in series" :key="s.slug" class="space-y-2">
          <div class="text-sm font-medium text-ink-gray-7">{{ s.name }}</div>
          <div class="grid grid-cols-6 justify-items-center gap-4 sm:grid-cols-8">
            <button
              v-for="url in s.avatars"
              :key="url"
              type="button"
              class="size-14 rounded-full outline-none ring-2 ring-transparent ring-offset-2 ring-offset-surface-white transition hover:ring-outline-gray-3 focus-visible:ring-ink-gray-9"
              :class="{ '!ring-ink-gray-9': url === current }"
              @click="choose(url)"
            >
              <img
                :src="url"
                loading="lazy"
                :alt="s.name"
                class="size-14 rounded-full"
              />
            </button>
          </div>
        </div>
      </div>
      <div v-else class="flex h-40 flex-col items-center justify-center gap-2">
        <p class="text-p-sm text-ink-gray-5">
          {{ __('Could not load the avatar gallery.') }}
        </p>
        <Button variant="subtle" :label="__('Retry')" @click="loadManifest(true)" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { validateIsImageFile } from '@/utils'
import {
  Dialog,
  Button,
  FileUploader,
  LoadingIndicator,
  ErrorMessage,
} from 'frappe-ui'
import { ref, computed, inject, watch } from 'vue'

// The curated avatar set ships as static app assets in tatva_connect; the manifest groups them by
// series. Static /assets means no File record, no Azure, no privacy layer — selecting one just points
// user_image at the URL (same as the LMS avatars already do).
const MANIFEST_URL = '/assets/tatva_connect/images/avatars/manifest.json'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  current: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'select'])

const { user: sessionUser } = inject('session')

const show = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const series = ref([])
const loading = ref(false)
let loaded = false

async function loadManifest(force = false) {
  if (loading.value || (loaded && !force)) return
  loading.value = true
  try {
    const res = await fetch(MANIFEST_URL)
    if (!res.ok) throw new Error(`manifest ${res.status}`)
    const data = await res.json()
    series.value = data.series || []
    loaded = true
  } catch (e) {
    // leave loaded=false so the next open (or Retry) tries again; the else branch shows the error state
    series.value = []
    loaded = false
  } finally {
    loading.value = false
  }
}

// fetch lazily, only the first time the dialog opens
watch(show, (open) => open && loadManifest())

function choose(url) {
  emit('select', url)
  show.value = false
}
</script>
