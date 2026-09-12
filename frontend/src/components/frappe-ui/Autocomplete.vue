<template>
  <Combobox
    v-model="selectedValue"
    nullable
    :multiple="multiple"
    :by="multiple ? 'value' : undefined"
  >
    <Popover v-model:show="showOptions" class="w-full" :placement="placement">
      <template #target="{ open: openPopover, togglePopover }">
        <slot
          name="target"
          v-bind="{
            open: openPopover,
            togglePopover,
            isOpen: showOptions,
            selectedValue,
            displayValue,
          }"
        >
          <div class="w-full">
            <button
              class="relative flex h-7 w-full items-center justify-between gap-2 rounded px-2 py-1 transition-colors"
              :class="inputClasses"
              @click="() => !disabled && togglePopover()"
            >
              <!-- TATVA: `pr-7` matches the placeholder below, and for the same reason: the chevron is
                   positioned OVER this row, so a row that does not reserve its width runs underneath it.
                   The empty state reserved it and the filled state did not, one line apart. -->
              <div
                v-if="hasSelection"
                class="flex min-w-0 pr-7 text-base leading-5 items-center truncate"
              >
                <slot name="prefix" />
                <span class="truncate">
                  {{ triggerLabel }}
                </span>
              </div>
              <div
                v-else
                class="absolute text-ink-gray-4 text-left truncate w-full pr-7"
              >
                {{ placeholder || '' }}
              </div>
              <FeatherIcon
                v-if="!disabled"
                name="chevron-down"
                class="absolute h-4 w-4 text-ink-gray-5 right-2"
                aria-hidden="true"
              />
            </button>
          </div>
        </slot>
      </template>
      <template #body="{ isOpen }">
        <div v-show="isOpen">
          <div
            class="relative mt-1 rounded-lg bg-surface-modal text-base shadow-2xl max-w-[350px]"
          >
            <div class="relative px-1.5 pt-1.5">
              <ComboboxInput
                ref="search"
                class="form-input w-full focus:bg-surface-gray-3 hover:bg-surface-gray-4 text-ink-gray-8"
                type="text"
                :value="query"
                autocomplete="off"
                :placeholder="__('Search')"
                @change="
                  (e) => {
                    query = e.target.value
                  }
                "
              />
              <button
                class="absolute right-1.5 inline-flex h-7 w-7 items-center justify-center"
                @click="selectedValue = multiple ? [] : null"
              >
                <FeatherIcon name="x" class="w-4 text-ink-gray-8" />
              </button>
            </div>
            <ComboboxOptions
              class="my-1 max-h-[12rem] overflow-y-auto p-1.5 pt-0"
              static
            >
              <div
                v-for="group in groups"
                v-show="group.items.length > 0"
                :key="group.key"
                class="mt-1.5"
              >
                <div
                  v-if="group.group && !group.hideLabel"
                  class="truncate bg-surface-modal px-2.5 py-1.5 text-sm font-medium text-ink-gray-5"
                >
                  {{ group.group }}
                </div>
                <ComboboxOption
                  v-for="option in group.items.slice(0, props.maxOptions)"
                  :key="option.value"
                  v-slot="{ active, selected }"
                  as="template"
                  :value="option"
                >
                  <li
                    :class="[
                      'flex cursor-pointer items-center rounded px-2.5 py-1.5 text-base',
                      { 'bg-surface-gray-3': active },
                    ]"
                  >
                    <!-- Which row is the chosen one. The combobox's own `selected` compares an option OBJECT against the string a caller holds, so it is never true here and no picker in the CRM showed a tick. -->
                    <slot
                      name="item-prefix"
                      v-bind="{ active, selected, option }"
                    >
                      <FeatherIcon
                        v-if="chosenValues.includes(option.value)"
                        name="check"
                        class="mr-2 h-4 w-4 shrink-0 text-ink-gray-7"
                      />
                      <div v-else class="mr-2 h-4 w-4 shrink-0" />
                    </slot>
                    <slot
                      name="item-label"
                      v-bind="{ active, selected, option }"
                    >
                      <div class="flex-1 truncate text-ink-gray-7">
                        {{ option.label }}
                      </div>
                    </slot>
                  </li>
                </ComboboxOption>
              </div>
              <li
                v-if="groups.length == 0"
                class="my-1.5 rounded-md px-2.5 py-1.5 text-base text-ink-gray-5"
              >
                {{ __('No results found') }}
              </li>
            </ComboboxOptions>
            <div
              v-if="slots.footer || multiple"
              class="border-t border-outline-gray-modals p-1.5"
            >
              <slot
                name="footer"
                v-bind="{ value: search?.el._value, close }"
              >
                <!-- TATVA: holding several, the default footer is the one frappe-ui's Autocomplete shows —
                     Select All until everything on offer is picked, then Clear All. Same words, same rule,
                     so a caller moving here sees no difference. A caller with its own footer still wins. -->
                <div v-if="multiple" class="flex items-center justify-end gap-1">
                  <Button
                    v-if="!allShownSelected"
                    variant="ghost"
                    :label="__('Select All')"
                    @click.stop="selectAllShown"
                  />
                  <Button
                    v-else
                    variant="ghost"
                    :label="__('Clear All')"
                    @click.stop="clearAllShown"
                  />
                </div>
              </slot>
            </div>
          </div>
        </div>
      </template>
    </Popover>
  </Combobox>
</template>

<script setup>
import {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/vue'
import { Popover, FeatherIcon, Button } from 'frappe-ui'
import { ref, computed, useAttrs, useSlots, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Array],
    default: '',
  },
  // TATVA: several values, or one. `Combobox` below has always supported it; nothing passed the answer in,
  // so every caller needing several had to mount frappe-ui's Autocomplete instead — a second control, with
  // a second row layout, chosen differently at five call sites. Same prop name and same model shape as
  // that one, so a caller moves across without rewriting anything.
  multiple: {
    type: Boolean,
    default: false,
  },
  options: {
    type: Array,
    default: () => [],
  },
  size: {
    type: String,
    default: 'sm',
  },
  variant: {
    type: String,
    default: 'subtle',
  },
  placeholder: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  filterable: {
    type: Boolean,
    default: true,
  },
  placement: {
    type: String,
    default: 'bottom-start',
  },
  maxOptions: {
    type: Number,
    default: 20,
  },
})
const emit = defineEmits(['update:modelValue', 'update:query', 'change'])

const query = ref('')
const showOptions = ref(false)
const search = ref(null)

const attrs = useAttrs()
const slots = useSlots()

const valuePropPassed = computed(() => 'value' in attrs)

const selectedValue = computed({
  get() {
    const v = valuePropPassed.value ? attrs.value : props.modelValue
    // Holding several, the Combobox works in OPTIONS; a caller holds plain values, so dress them here.
    if (props.multiple) return (Array.isArray(v) ? v : []).map(asOption)
    return v
  },
  set(val) {
    query.value = ''
    // Picking one value closes the list; picking from several keeps it open.
    if (val && !props.multiple) {
      showOptions.value = false
    }
    emit(valuePropPassed.value ? 'change' : 'update:modelValue', val)
  },
})

// The chosen keys. A caller holds plain values; mid-selection the Combobox holds option objects.
const keyOf = (v) => (v && typeof v === 'object' ? v.value : v)
const chosenValues = computed(() => {
  const v = selectedValue.value
  if (Array.isArray(v)) return v.map(keyOf)
  return v === null || v === undefined || v === '' ? [] : [keyOf(v)]
})

// Holding one value this is the stock test and the stock label, unchanged.
const hasSelection = computed(() =>
  props.multiple ? chosenValues.value.length > 0 : Boolean(selectedValue.value),
)

// Several picks read as a count, so a fixed-height trigger cannot grow with them.
const triggerLabel = computed(() => {
  if (!props.multiple) return displayValue(selectedValue.value)
  const chosen = selectedValue.value || []
  return chosen.length === 1
    ? displayValue(chosen[0])
    : __('{0} selected', [chosen.length])
})

// Every row on offer right now — what Select All selects, and never a fetch of the whole master.
const shownValues = computed(() =>
  groups.value.flatMap((g) => g.items).map((o) => o.value),
)
const allShownSelected = computed(
  () => shownValues.value.length > 0 && shownValues.value.every((v) => chosenValues.value.includes(v)),
)
function selectAllShown() {
  selectedValue.value = shownValues.value.map((v) => asOption(v))
}
function clearAllShown() {
  selectedValue.value = props.multiple ? [] : null
}

function close() {
  showOptions.value = false
}

const groups = computed(() => {
  if (!props.options || props.options.length == 0) return []

  let groups = props.options[0]?.group
    ? props.options
    : [{ group: '', items: props.options }]

  return groups
    .map((group, i) => {
      return {
        key: i,
        group: group.group,
        hideLabel: group.hideLabel || false,
        items: props.filterable ? filterOptions(group.items) : group.items,
      }
    })
    .filter((group) => group.items.length > 0)
})

function filterOptions(options) {
  if (!query.value) {
    return options
  }
  return options.filter((option) => {
    let searchTexts = [option.label, option.value]
    return searchTexts.some((text) =>
      (text || '').toString().toLowerCase().includes(query.value.toLowerCase()),
    )
  })
}

function asOption(v) {
  if (v && typeof v === 'object') return v
  const all = groups.value.flatMap((group) => group.items)
  return all.find((o) => o.value === v) || { label: String(v), value: v }
}

function displayValue(option) {
  if (typeof option === 'string') {
    let allOptions = groups.value.flatMap((group) => group.items)
    let selectedOption = allOptions.find((o) => o.value === option)
    return selectedOption?.label || option
  }
  return option?.label
}

watch(query, (q) => {
  emit('update:query', q)
})

watch(showOptions, (val) => {
  if (val) {
    nextTick(() => {
      search.value.el.focus()
    })
  }
})

const textColor = computed(() => {
  return props.disabled ? 'text-ink-gray-5' : 'text-ink-gray-8'
})

const inputClasses = computed(() => {
  let sizeClasses = {
    sm: 'text-base rounded h-7',
    md: 'text-base rounded h-8',
    lg: 'text-lg rounded-md h-10',
    xl: 'text-xl rounded-md h-10',
  }[props.size]

  let paddingClasses = {
    sm: 'py-1.5 px-2',
    md: 'py-1.5 px-2.5',
    lg: 'py-1.5 px-3',
    xl: 'py-1.5 px-3',
  }[props.size]

  let variant = props.disabled ? 'disabled' : props.variant
  let variantClasses = {
    subtle:
      'border border-[--surface-gray-2] bg-surface-gray-2 placeholder-ink-gray-4 hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:bg-surface-white focus:border-outline-gray-4 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3',
    outline:
      'border border-outline-gray-2 bg-surface-white placeholder-ink-gray-4 hover:border-outline-gray-3 hover:shadow-sm focus:bg-surface-white focus:border-outline-gray-4 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3',
    // TATVA: a muted control wears the CONTROL fill every other disabled control wears (TextInput/Select), never `surface-menu-bar` — a chrome token that tracks the sidebar and reads a shade apart in dark.
    disabled: [
      'border bg-surface-gray-1 placeholder-ink-gray-3',
      props.variant === 'outline'
        ? 'border-outline-gray-2'
        : 'border-transparent',
    ],
  }[variant]

  return [
    sizeClasses,
    paddingClasses,
    variantClasses,
    textColor.value,
    'transition-colors w-full',
  ]
})

// TATVA: `isOpen` joins `query` because a control that fetches its own options needs to know when they are actually about to be looked at.
defineExpose({ query, isOpen: showOptions })
</script>
