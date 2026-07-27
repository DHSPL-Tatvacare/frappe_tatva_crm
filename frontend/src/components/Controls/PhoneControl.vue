<!--
  A phone input for a `Data` field whose `options` is `Phone` — Frappe's own way of saying "this field
  holds a number", so this renders wherever core already declares one and needs no per-form wiring.

  The country select is an aid for TYPING, not a field. It puts the dial code in front so the person does
  not have to know they must, and what goes up is an ordinary `+<code><number>` string. Nothing about the
  country is stored beside it: once a value reads `+966…` it carries its own country for ever, which is
  what WhatsApp and telephony read back.

  The list is ONE `createResource` at module scope with a cache key — the same shape the CRM's stores use
  for a session-wide list — so every phone field on every form shares one request, fetched when a phone
  field first mounts rather than at app boot.

  The SERVER is the authority: `whatsapp.phone.to_e164` refuses a number that is not real and reads the
  site's own country for anything typed without a `+`. This control validates nothing.
-->
<template>
  <div class="flex gap-2">
    <Autocomplete
      class="w-32 shrink-0"
      :options="options"
      :modelValue="selected"
      :loading="countries.loading"
      :disabled="disabled"
      :placeholder="__('Code')"
      @update:modelValue="pickCountry"
    />
    <FormControl
      class="flex-1"
      type="text"
      :value="national"
      :placeholder="placeholder"
      :disabled="disabled"
      :description="description"
      @change="typeNumber($event.target.value)"
    />
  </div>
</template>

<script>
import { createResource } from 'frappe-ui'

// Plain <script> runs ONCE per module, so one resource serves every phone field in the app; `cache` dedupes the request.
export const countries = createResource({
  url: 'tatva_connect.whatsapp.phone.dial_codes',
  cache: 'tatva-dial-codes',
  initialData: [],
})

// India, because that is what this CRM runs on. A typing hint only — the server reads System Settings to decide.
export const HOME_DIAL = '+91'
</script>

<script setup>
import { Autocomplete, FormControl } from 'frappe-ui'
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  value: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  description: { type: String, default: '' },
})
const emit = defineEmits(['change'])

// Fetched when a phone field first mounts, not at app boot; `cache` makes every later mount a no-op.
onMounted(() => {
  if (!countries.data?.length) countries.fetch()
})

const options = computed(() =>
  (countries.data || []).map((r) => ({
    label: `${r.dial}  ${r.country}`,
    value: r.dial,
  })),
)

const picked = ref('')

// The code the value carries. Longest match wins — `+9` opens both `+91` and `+966`, so a short match reads Saudi as Indian.
const dial = computed(() => {
  const s = String(props.value || '')
  if (s.startsWith('+')) {
    const known = (countries.data || [])
      .map((r) => r.dial)
      .filter((d) => s.startsWith(d))
      .sort((a, b) => b.length - a.length)[0]
    if (known) return known
    if (s.startsWith(HOME_DIAL)) return HOME_DIAL
  }
  return picked.value || HOME_DIAL
})

// Autocomplete compares options by `.value`, so the current code is handed back as its option object.
const selected = computed(
  () => options.value.find((o) => o.value === dial.value) || null,
)

// What the box shows: the number without its code, so the rep sees the digits they know.
const national = computed(() => {
  const s = String(props.value || '')
  return s.startsWith(dial.value) ? s.slice(dial.value.length) : s.replace(/^\+/, '')
})

function compose(code, number) {
  const digits = String(number || '').replace(/\D/g, '')
  return digits ? `${code}${digits}` : ''
}

function pickCountry(option) {
  picked.value = option?.value ?? HOME_DIAL
  emit('change', compose(picked.value, national.value))
}

function typeNumber(typed) {
  // Pasted WITH a country code wins over the picker — the only reading that cannot silently make a foreign number Indian.
  const s = String(typed || '').trim()
  if (s.startsWith('+') || s.startsWith('00')) {
    picked.value = ''
    emit('change', '+' + s.replace(/^00/, '').replace(/\D/g, ''))
    return
  }
  emit('change', compose(dial.value, s))
}
</script>
