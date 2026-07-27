<!--
  A phone input for a `Data` field whose `options` is `Phone` — Frappe's own way of saying "this field
  holds a number", so this renders wherever core already declares one and needs no per-form wiring.

  Costs NOTHING to render. The opening code is +91, the country list is not loaded, and no request is made.
  A rep entering Indian numbers all day never triggers a fetch. The 243-country list is asked for once, the
  first time somebody actually opens the picker, and is then shared by every phone field on the page.

  The picker is an aid for TYPING, not a field. It puts the dial code in front so the person does not have
  to know they must, and what goes up is an ordinary `+<code><number>` string. Nothing about the country is
  stored beside it: once the value reads `+966…` it carries its own country for ever, which is exactly what
  WhatsApp and telephony read back.

  The SERVER is the authority — `whatsapp.phone.to_e164` refuses a number that is not real and reads the
  site's own System Settings country for anything typed without a `+`. This control only makes the common
  case quick to type; it validates nothing.
-->
<template>
  <div class="flex gap-2">
    <Autocomplete
      class="w-32 shrink-0"
      :options="options"
      :modelValue="dial"
      :disabled="disabled"
      :placeholder="dial"
      @update:modelValue="pickCountry"
      @open="loadCountries"
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

<script setup>
import { Autocomplete, FormControl, createResource } from 'frappe-ui'
import { computed, ref } from 'vue'

const props = defineProps({
  value: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  description: { type: String, default: '' },
})
const emit = defineEmits(['change'])

// India, because that is what this CRM runs on. A typing hint only — the server reads System Settings to decide.
const HOME_DIAL = '+91'

// Not `auto`: nothing is fetched until someone opens the picker, and `cache` makes that one fetch serve the session.
const countries = createResource({
  url: 'tatva_connect.whatsapp.phone.dial_codes',
  cache: 'tatva-dial-codes',
})
function loadCountries() {
  if (!countries.data) countries.fetch()
}

const rows = computed(() => countries.data || [])
const options = computed(() =>
  rows.value.map((r) => ({ label: `${r.dial}  ${r.country}`, value: r.dial })),
)

// The code the value carries. Longest match wins — `+9` opens both `+91` and `+966`, so a short match reads Saudi as Indian.
const picked = ref('')
const dial = computed(() => {
  const s = String(props.value || '')
  if (s.startsWith('+')) {
    const known = rows.value
      .map((r) => r.dial)
      .filter((d) => s.startsWith(d))
      .sort((a, b) => b.length - a.length)[0]
    // Before the list is loaded there is nothing to match against, so read the home code directly.
    if (known) return known
    if (s.startsWith(HOME_DIAL)) return HOME_DIAL
  }
  return picked.value || HOME_DIAL
})

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
  picked.value = option?.value ?? option ?? HOME_DIAL
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
