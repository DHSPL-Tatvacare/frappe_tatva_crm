<!--
  A phone input for a `Data` field whose `options` is `Phone` — Frappe's own way of saying "this field
  holds a number", so this renders wherever core already declares one and needs no per-form wiring.

  The country select is an aid for TYPING, not a field. It puts the dial code in front so the person does
  not have to know they must, and what goes up is an ordinary `+<code><number>` string. Nothing about the
  country is stored beside it: once a value reads `+966…` it carries its own country for ever, which is
  what WhatsApp and telephony read back.

  The list comes from `composables/dialCodes.js` — one shared resource for the app, the same shape
  `useMapConfig` uses, fetched by the first phone field that renders and never at app boot.

  The SERVER is the authority: `whatsapp.phone.to_e164` refuses a number that is not real and reads the
  site's own country for anything typed without a `+`. This control validates nothing.
-->
<template>
  <div class="flex items-start gap-2">
    <!-- A native select, not an Autocomplete. frappe-ui's Autocomplete hardcodes `w-full` on its inner
         Popover, so any width given to it is ignored — it took the whole row and pushed the number field
         off screen. It also hardcodes `match-target-width`, so narrowing the target would narrow the
         country list with it. A select stays the size it is told, and on a phone it opens the OS picker. -->
    <FormControl
      class="w-28 shrink-0"
      type="select"
      :options="options"
      :modelValue="dial"
      :disabled="disabled || countries.loading"
      @update:modelValue="pickCountry"
    />
    <FormControl
      class="min-w-0 flex-1"
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
import { FormControl } from 'frappe-ui'
import { computed, ref } from 'vue'
import { useDialCodes } from '@/composables/dialCodes'

// India, because that is what this CRM runs on. A typing hint only — the server reads System Settings to decide.
const HOME_DIAL = '+91'

const countries = useDialCodes()

const props = defineProps({
  value: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  description: { type: String, default: '' },
})
const emit = defineEmits(['change'])

// The closed select shows the selected option's own text, and the box is deliberately narrow — so the
// label leads with the dial code (what the rep needs to see) and carries the country for picking.
const options = computed(() =>
  (countries.data || []).map((r) => ({
    label: `${r.dial} ${r.country}`,
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

// What the box shows: the number without its code, so the rep sees the digits they know.
const national = computed(() => {
  const s = String(props.value || '')
  return s.startsWith(dial.value) ? s.slice(dial.value.length) : s.replace(/^\+/, '')
})

function compose(code, number) {
  const digits = String(number || '').replace(/\D/g, '')
  return digits ? `${code}${digits}` : ''
}

function pickCountry(code) {
  picked.value = code || HOME_DIAL
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
