<template>
  <div class="flex items-start gap-2">
    <div class="shrink-0">
      <Popover v-model:show="isOpen" placement="bottom-start">
        <template #target="{ togglePopover }">
          <Button
            :label="dial || __('Country')"
            :iconRight="isOpen ? 'chevron-up' : 'chevron-down'"
            :disabled="disabled || countries.loading"
            @click="togglePopover"
          >
            <template v-if="flag" #prefix>
              <span aria-hidden="true">{{ flag }}</span>
            </template>
          </Button>
        </template>
        <template #body="{ close }">
          <div
            class="mt-1 w-64 overflow-hidden rounded-lg bg-surface-modal shadow-2xl"
          >
            <div class="border-b border-outline-gray-1 p-1.5">
              <TextInput
                v-model="query"
                class="w-full"
                :placeholder="__('Search')"
                :tabindex="isMobileView ? -1 : 0"
                autocomplete="off"
                @keydown.enter.prevent="selectCountry(filtered[0]?.region, close)"
              />
            </div>
            <ul class="max-h-64 overflow-y-auto p-1">
              <li v-for="(option, idx) in filtered" :key="option.region">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-base hover:bg-surface-gray-2"
                  :class="{
                    'bg-surface-gray-3':
                      query ? idx === 0 : option.region === region,
                  }"
                  @click="selectCountry(option.region, close)"
                >
                  <span aria-hidden="true">{{ flagOf(option.region) }}</span>
                  <span class="flex-1 truncate text-ink-gray-7">
                    {{ option.country }}
                  </span>
                  <span class="shrink-0 text-ink-gray-5">{{ option.dial }}</span>
                </button>
              </li>
              <li
                v-if="!filtered.length"
                class="px-2 py-3 text-center text-base text-ink-gray-5"
              >
                {{ __('No country found') }}
              </li>
            </ul>
          </div>
        </template>
      </Popover>
    </div>
    <FormControl
      class="min-w-0 flex-1"
      type="text"
      :value="number"
      :placeholder="placeholder"
      :disabled="disabled"
      :description="description"
      @change="typeNumber($event.target.value)"
    />
  </div>
</template>

<script setup>
import { Button, FormControl, Popover, TextInput } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useDialCodes } from '@/composables/dialCodes'
import { isMobileView } from '@/composables/settings'

const props = defineProps({
  value: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  description: { type: String, default: '' },
})
const emit = defineEmits(['change'])

const countries = useDialCodes()
const isOpen = ref(false)
const query = ref('')

// The country and the national digits are held here, never derived from the prop on the fly: a pick and a keystroke both have to survive the round trip through the parent that they cause.
const region = ref('')
const number = ref('')

const rows = computed(() => countries.data || [])

function flagOf(code) {
  const iso = String(code || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(iso)) return ''
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

function dialOf(code) {
  return rows.value.find((r) => r.region === code)?.dial || ''
}

// Only what a rep types is normalised — a stored number is already E.164, `to_e164` being the one gate on CRM Lead.validate.
function digitsOf(value) {
  return String(value || '').replace(/\D/g, '')
}

const dial = computed(() => dialOf(region.value))
const flag = computed(() => flagOf(region.value))
const defaultRegion = computed(() => rows.value.find((r) => r.default)?.region || '')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(
    (r) => r.country.toLowerCase().includes(q) || r.dial.includes(q),
  )
})

// The longest dial code the value starts with, and the primary country among the ones sharing it.
function regionFor(value) {
  const s = String(value || '')
  if (!s.startsWith('+')) return ''
  let best = ''
  for (const r of rows.value) {
    if (s.startsWith(r.dial) && r.dial.length > best.length) best = r.dial
  }
  if (!best) return ''
  const sharing = rows.value.filter((r) => r.dial === best)
  return (sharing.find((r) => r.primary) || sharing[0]).region
}

function parse(value) {
  const s = String(value || '')
  if (!s) {
    region.value = defaultRegion.value
    number.value = ''
    return
  }
  const found = regionFor(s)
  if (found) {
    region.value = found
    number.value = s.slice(dialOf(found).length)
    return
  }
  region.value = region.value || defaultRegion.value
  number.value = s.replace(/^\+/, '')
}

function compose() {
  if (!number.value) return ''
  return dial.value ? `${dial.value}${number.value}` : number.value
}

// Runs again when the list lands, which is the first moment a value can be read or a default known.
watch(
  [() => props.value, rows],
  () => {
    if (!rows.value.length) return
    if (region.value && String(props.value || '') === compose()) return
    parse(props.value)
  },
  { immediate: true },
)

watch(isOpen, (open) => {
  if (!open) query.value = ''
})

function push() {
  emit('change', compose())
}

function selectCountry(code, close) {
  if (!code) return
  region.value = code
  close()
  push()
}

function typeNumber(typed) {
  // Pasted with a country code wins over the picker.
  const s = String(typed || '').trim()
  if (s.startsWith('+') || s.startsWith('00')) {
    parse('+' + digitsOf(s.replace(/^00/, '')))
  } else {
    number.value = digitsOf(s)
  }
  push()
}
</script>
