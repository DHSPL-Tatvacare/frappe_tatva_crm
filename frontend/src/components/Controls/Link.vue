<template>
  <div class="space-y-1.5 p-[2px] -m-[2px]">
    <label v-if="attrs.label" class="block" :class="labelClasses">
      {{ __(attrs.label) }}
    </label>
    <Autocomplete
      ref="autocomplete"
      v-model="value"
      :options="displayOptions"
      :size="attrs.size || 'sm'"
      :variant="attrs.variant"
      :placeholder="attrs.placeholder"
      :disabled="attrs.disabled"
      :placement="attrs.placement"
      :multiple="multiple"
      :filterable="false"
      :maxOptions="PAGE_LENGTH"
    >
      <template #target="{ open, togglePopover }">
        <slot name="target" v-bind="{ open, togglePopover }" />
      </template>

      <template #prefix>
        <slot name="prefix" />
      </template>

      <!-- Declared ONLY when a caller has one: an unconditional template overrode the picker's own tick with nothing. -->
      <template
        v-if="$slots['item-prefix']"
        #item-prefix="{ active, selected, option }"
      >
        <slot name="item-prefix" v-bind="{ active, selected, option }" />
      </template>

      <template #item-label="{ active, selected, option }">
        <slot name="item-label" v-bind="{ active, selected, option }">
          <div v-if="option.description" class="flex flex-col gap-1">
            <div class="flex-1 font-semibold truncate text-ink-gray-7">
              {{ option.label }}
            </div>
            <div class="flex-1 text-sm truncate text-ink-gray-5">
              {{ option.description }}
            </div>
          </div>
          <div v-else class="flex-1 truncate text-ink-gray-7">
            {{ option.label }}
          </div>
        </slot>
      </template>

      <template #footer="{ value: v, close }">
        <div v-if="attrs.onCreate">
          <Button
            variant="ghost"
            class="w-full !justify-start"
            :label="__('Create New')"
            iconLeft="plus"
            @click="() => attrs.onCreate(v, close)"
          />
        </div>
        <div>
          <Button
            variant="ghost"
            class="w-full !justify-start"
            :label="__('Clear')"
            iconLeft="x"
            @click="() => clearValue(close)"
          />
        </div>
      </template>
    </Autocomplete>
  </div>
</template>

<script setup>
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { isTranslatable } from '@/utils'
import { watchDebounced } from '@vueuse/core'
import { createResource } from 'frappe-ui'
import {
  knownLinkTitle,
  ensureLinkTitle,
  rememberLinkTitle,
  optionDescriptions,
} from '@/tatva/linkTitle'
import { useAttrs, computed, ref, inject, watch } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  // TATVA: a server-named scoped link query (frappe's own `search_link` param); null keeps the default search.
  query: { type: String, default: null },
  filters: { type: [Array, Object, String], default: () => [] },
  modelValue: { type: [String, Array], default: '' },
  // TATVA: several values, or one — the picker below already holds either; this is the caller's say.
  multiple: { type: Boolean, default: false },
  hideMe: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const attrs = useAttrs()

const valuePropPassed = computed(() => 'value' in attrs)

const value = computed({
  get: () => {
    let v = valuePropPassed.value ? attrs.value : props.modelValue

    const shown = (one) => (isTranslatable(props.doctype) ? __(one) : one)
    if (props.multiple) return (Array.isArray(v) ? v : []).map(shown)
    return shown(v)
  },
  set: (val) => {
    const picked = props.multiple ? val || [] : val
    // TATVA: the option carries the title this picker just drew; keeping it means a caller that renders the chosen value never shows the composite PK back.
    function keep(o) {
      if (o?.value) rememberLinkTitle(props.doctype, o.value, o.label)
    }
    if (props.multiple) {
      picked.forEach(keep)
      return emit(
        valuePropPassed.value ? 'change' : 'update:modelValue',
        picked.map((o) => (o && typeof o === 'object' ? o.value : o)),
      )
    }
    if (!picked?.value) return
    keep(picked)
    return emit(
      valuePropPassed.value ? 'change' : 'update:modelValue',
      picked.value,
    )
  },
})

const autocomplete = ref(null)
const text = ref('')

// What this picker holds right now, and what it held when the list was opened.
const chosen = computed(() =>
  Array.isArray(currentValue.value) ? currentValue.value.filter(Boolean) : [],
)
const pinned = ref([])

// TATVA: `search_link` defaults page_length to 10 (frappe/desk/search.py:44), so every picker was capped at ten and the server query's own ceiling was unreachable. Asked for explicitly, at that ceiling.
// The picker's own `maxOptions` defaults to 20, so the caller that named the ceiling names it there too — 30 answers the server sent were being dropped unseen.
const PAGE_LENGTH = 50

// TATVA: same per-doc `_link_titles` map Field.vue reads (FieldLayout/SidePanelLayout provide it); null off a doc.
const linkTitles = inject('linkTitles', null)

const currentValue = computed(() =>
  valuePropPassed.value ? attrs.value : props.modelValue,
)

// TATVA: two sources, one answer. The injected map covers a control living on a document or a list.
// Off one — the workflow canvas, where a Link value lives in a node's config_json — nothing provides it,
// and the control showed the raw composite PK. `ensureLinkTitle` closes that by asking the framework's
// own link search, which is where the title comes from in BOTH cases.
const titleOf = (v) =>
  linkTitles?.value?.[`${props.doctype}::${v}`] || knownLinkTitle(props.doctype, v)

const resolvedTitle = computed(() => titleOf(currentValue.value))

// Only when nobody has already answered: on a document the injected map is there on the first frame, so
// this never fires and no request is added to a form load.
watch(
  [() => props.doctype, currentValue],
  ([doctype, v]) => {
    if (!doctype || !v) return
    // TATVA: holding several values this asks for NOTHING. `ensureLinkTitle` is one request per value and
    // there is no batch endpoint, so a condition holding 80 stages would open with 80 `search_link` calls.
    // Nothing needs them: the closed trigger reads a COUNT past one pick, the ticks compare values and not
    // labels, and `displayOptions` below labels a chosen row from the cache when it has one. A title is
    // decoration; a burst is not worth it.
    if (props.multiple) return
    if (linkTitles?.value?.[`${doctype}::${v}`]) return
    ensureLinkTitle(doctype, v, { query: props.query, filters: props.filters })
  },
  { immediate: true },
)

// TATVA: the OPEN list leaked the key the closed display already hides. Frappe builds an option's
// description from the columns the query returned and the PRIMARY KEY is one of them
// (`search.py: build_for_autosuggest`), which for our three composite masters prints
// `condition::Goodflip::India::Inside-Sales::htn` in grey under a clean `Hypertension`. A key is storage:
// the client filters and saves on it and a rep never reads it. So any part of the description that
// restates the label, or that the key already contains, is dropped — and a description left with nothing
// to say is dropped with it. Stated as a rule about redundancy, never by looking for `::`: nothing here
// parses a key, which is the same line `taxonomy/labels.py` draws.
const readable = (o) => {
  const parts = String(o.description || '')
    .split(', ')
    .filter((p) => p && p !== o.label && !String(o.value || '').includes(p))
  return parts.join(', ')
}

// Prepend the current value titled from that map so the closed display shows the title, not the raw `::` PK.
const displayOptions = computed(() => {
  const opts = (options.data || []).map((o) =>
    o.description ? { ...o, description: readable(o) || undefined } : o,
  )
  if (props.multiple) {
    // TATVA: PINNED, not "currently chosen". Keyed off what was held when the list opened, so UNTICKING a
    // row leaves it on screen to be ticked again — reading `chosen` here made a row disappear the moment
    // it was cleared, because the server's page does not contain it and nothing was left to put it back.
    const missing = pinned.value
      .filter((v) => v && !opts.some((o) => o.value === v))
      .map((v) => ({ value: v, label: titleOf(v) || v }))
    return [...missing, ...opts]
  }
  const v = currentValue.value
  const title = resolvedTitle.value
  if (!v || !title || opts.some((o) => o.value === v)) return opts
  return [{ value: v, label: title }, ...opts]
})

// TATVA: a CLOSED picker shows its title from `ensureLinkTitle` and never these options, so it does not fetch them — mounted eagerly a Route with four rows spent twelve requests before the author touched anything.
const opened = ref(false)

watch(
  () => autocomplete.value?.isOpen,
  (isOpen) => {
    if (!isOpen) return
    // Held for as long as this list is open, so a row stays put when it is unticked.
    pinned.value = [...new Set([...pinned.value, ...chosen.value])]
    if (opened.value) return
    opened.value = true
    reload(text.value)
  },
)

watchDebounced(
  () => autocomplete.value?.query,
  (val) => {
    val = val || ''
    if (text.value === val) return
    text.value = val
    reload(val)
  },
  { debounce: 300, immediate: true },
)

watchDebounced(
  () => props.doctype,
  () => reload(''),
  { debounce: 300, immediate: true },
)

watchDebounced(
  () => props.filters,
  () => {
    reload('', true)
  },
  { debounce: 300, immediate: true },
)

const options = createResource({
  url: 'frappe.desk.search.search_link',
  cache: [props.doctype, text.value, props.hideMe, props.filters, props.query],
  method: 'POST',
  params: {
    txt: text.value,
    doctype: props.doctype,
    query: props.query,
    filters: props.filters,
    page_length: PAGE_LENGTH,
  },
  transform: (data) => {
    // TATVA: resolved across the whole result set — a repeated label needs its subtitle to tell it apart
    const describe = optionDescriptions(data)
    let allData = data.map((option) => {
      return {
        label: option.label || option.value,
        value: option.value,
        description: describe(option),
      }
    })
    if (!props.hideMe && props.doctype == 'User') {
      allData.unshift({
        label: '@me',
        value: '@me',
      })
    }
    return allData
  },
})

function reload(val, force = false) {
  if (!props.doctype) return
  // Every way in comes through here, so the not-yet-opened rule is stated once and the first open replays it.
  if (!opened.value) return
  if (
    !force &&
    options.data?.length &&
    val === options.params?.txt &&
    props.doctype === options.params?.doctype
  )
    return

  options.update({
    params: {
      txt: val,
      doctype: props.doctype,
      query: props.query,
      filters: props.filters,
      page_length: PAGE_LENGTH,
    },
  })
  options.reload()
}

function clearValue(close) {
  emit(valuePropPassed.value ? 'change' : 'update:modelValue', '')
  close()
}




const labelClasses = computed(() => {
  return [
    {
      sm: 'text-xs',
      md: 'text-base',
    }[attrs.size || 'sm'],
    'text-ink-gray-5',
  ]
})

defineExpose({ reload })
</script>
