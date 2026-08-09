<!--
  A phone input for a `Data` field whose `options` is `Phone` — Frappe's own way of saying "this field
  holds a number", so this renders wherever core already declares one and needs no per-form wiring.

  The country picker is an aid for TYPING, not a field. It puts the dial code in front so the person does
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
    <!-- No width on this wrapper and none on the Autocomplete either — the trigger is as wide as the flag and code it holds, and a width handed to the component would be ignored anyway (frappe-ui hardcodes `w-full` on the Popover anchor). -->
    <div class="shrink-0">
      <Autocomplete
        :options="options"
        :modelValue="dial"
        :maxOptions="options.length"
        bodyClasses="w-64"
        placement="bottom-start"
        @change="(option) => pickCountry(option?.value)"
      >
        <!-- `match-target-width` is a MIN-width, so a trigger this narrow still gets a readable list — the country list is sized by bodyClasses above. -->
        <template #target="{ togglePopover, isOpen }">
          <Button
            :label="dial"
            :iconRight="isOpen ? 'chevron-up' : 'chevron-down'"
            :disabled="disabled || countries.loading"
            @click="togglePopover"
          >
            <template v-if="currentFlag" #prefix>
              <span aria-hidden="true">{{ currentFlag }}</span>
            </template>
          </Button>
        </template>
        <template #item-prefix="{ option }">
          <span aria-hidden="true">{{ option.flag }}</span>
        </template>
      </Autocomplete>
    </div>
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
import { Autocomplete, Button, FormControl } from 'frappe-ui'
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

// The ISO-3166 alpha-2 the payload already carries, as the regional-indicator pair a platform draws as a flag — no image, no icon set, no list of countries here.
function flagOf(region) {
  const code = String(region || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// The label carries BOTH so Autocomplete's own filter matches either — "ind", "91" and "+966" all land; the closed trigger shows the flag and code alone, which is all a rep needs while typing digits.
const options = computed(() =>
  (countries.data || []).map((r) => ({
    label: `${r.dial} ${r.country}`,
    value: r.dial,
    flag: flagOf(r.region),
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

// Several countries share one dial code (+1 is the whole NANP) and only the code is stored, so the flag shown is the first country holding it — the same one the picker offers under that code.
const currentFlag = computed(() => options.value.find((o) => o.value === dial.value)?.flag || '')

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
