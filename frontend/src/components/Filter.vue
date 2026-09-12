<template>
  <Popover placement="bottom-end">
    <template #target="{ togglePopover, close }">
      <div class="flex items-center">
        <!-- TATVA: `hideLabel` mirrors SortBy.vue's prop of the same name — icon-only, for a narrow row where a secondary control must not crowd out the primary action. -->
        <!-- The label is ALWAYS the real string: Button paints it only when there is no `icon`, and otherwise makes it the aria-label. `!hideLabel && …` handed it the boolean false, so the icon-only button announced itself as "false". -->
        <Button
          :label="__('Filter')"
          :class="filters?.size ? 'rounded-r-none' : ''"
          :icon="hideLabel ? FilterIcon : undefined"
          :iconLeft="hideLabel ? undefined : FilterIcon"
          :tooltip="hideLabel ? __('Filter') : ''"
          @click="togglePopover"
        >
          <template v-if="filters?.size" #suffix>
            <div
              class="flex h-5 w-5 items-center justify-center rounded-[5px] bg-surface-white pt-px text-xs font-medium text-ink-gray-8 shadow-sm"
            >
              {{ filters.size }}
            </div>
          </template>
        </Button>
        <Button
          v-if="filters?.size"
          :tooltip="__('Clear All Filters')"
          class="rounded-l-none border-l"
          icon="x"
          @click.stop="clearfilter(close)"
        />
      </div>
    </template>
    <template #body="{ close }">
      <div
        class="my-2 min-w-40 rounded-lg bg-surface-modal shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
      >
        <div class="min-w-72 p-2 sm:min-w-[400px]">
          <template v-if="filters?.size">
            <div
              v-for="(f, i) in filters"
              id="filter-list"
              :key="i"
              class="mb-4 sm:mb-3"
            >
              <div v-if="isMobileView" class="flex flex-col gap-2">
                <div class="-mb-2 flex w-full items-center justify-between">
                  <div class="text-base text-ink-gray-5">
                    {{ i == 0 ? __('Where') : __('And') }}
                  </div>
                  <Button
                    class="flex"
                    variant="ghost"
                    icon="x"
                    @click="removeFilter(i)"
                  />
                </div>
                <div id="fieldname" class="w-full">
                  <Autocomplete
                    :value="f.field.fieldname"
                    :options="fieldData"
                    :placeholder="__('First Name')"
                    @change="(e) => updateFilter(e, i)"
                  />
                </div>
                <div id="operator">
                  <FormControl
                    v-model="f.operator"
                    type="select"
                    :options="
                      getOperators(f.field.fieldtype, f.field.fieldname)
                    "
                    :placeholder="__('Equals')"
                    @update:modelValue="() => updateOperator(f)"
                  />
                </div>
                <div id="value" class="w-full">
                  <!-- An operator that takes no value (is set / is not set) resolves to no control at
                       all, rather than to an input nobody may fill. -->
                  <component
                    :is="getValueControl(f)"
                    v-if="getValueControl(f)"
                    v-model="f.value"
                    :placeholder="placeholder(f)"
                    @change="(v) => updateValue(v, f)"
                  />
                </div>
              </div>
              <div v-else class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <div class="w-13 pl-2 text-end text-base text-ink-gray-5">
                    {{ i == 0 ? __('Where') : __('And') }}
                  </div>
                  <div id="fieldname" class="!min-w-[140px]">
                    <Autocomplete
                      :value="f.field.fieldname"
                      :options="fieldData"
                      :placeholder="__('First Name')"
                      @change="(e) => updateFilter(e, i)"
                    />
                  </div>
                  <div id="operator">
                    <FormControl
                      v-model="f.operator"
                      type="select"
                      :options="
                        getOperators(f.field.fieldtype, f.field.fieldname)
                      "
                      :placeholder="__('Equals')"
                      @update:modelValue="() => updateOperator(f)"
                    />
                  </div>
                  <div id="value" class="!min-w-[140px]">
                    <component
                      :is="getValueControl(f)"
                      v-if="getValueControl(f)"
                      v-model="f.value"
                      :placeholder="placeholder(f)"
                      @change="(v) => updateValue(v, f)"
                    />
                  </div>
                </div>
                <Button
                  class="flex"
                  variant="ghost"
                  icon="x"
                  @click="removeFilter(i)"
                />
              </div>
            </div>
          </template>
          <div
            v-else
            class="mb-3 flex h-7 items-center px-3 text-sm text-ink-gray-5"
          >
            {{ __('Empty - Choose a field to filter by') }}
          </div>
          <div class="flex items-center justify-between gap-2">
            <Autocomplete
              value=""
              :options="availableFilters"
              :placeholder="__('First Name')"
              @change="(e) => setfilter(e)"
            >
              <template #target="{ togglePopover }">
                <Button
                  class="!text-ink-gray-5"
                  variant="ghost"
                  :label="__('Add Filter')"
                  iconLeft="plus"
                  @click="togglePopover()"
                />
              </template>
            </Autocomplete>
            <Button
              v-if="filters?.size"
              class="!text-ink-gray-5"
              variant="ghost"
              :label="__('Clear All Filters')"
              @click="clearfilter(close)"
            />
          </div>
        </div>
      </div>
    </template>
  </Popover>
</template>
<script setup>
import FilterIcon from '@/components/Icons/FilterIcon.vue'
import { LENS_CACHE_GENERATION } from '@/tatva/lensCache' // TATVA: retires every cached field list at once
// TATVA: ONE place decides which control edits a value — shared with the quick filter bar and the Smart
// View builder. The date pickers, Link, Duration and Rating controls this file reached for directly now
// live behind it, which is why they are no longer imported here.
import { resolveControl } from '@/tatva/fieldControl'
// TATVA: a derived field is not a column — the menu offers only what the server can compose (see derivedField).
import { appliedFilters, narrowOperators } from '@/tatva/derivedField'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { FormControl, createResource, Popover } from 'frappe-ui'
// The same control `fieldControl` resolves to, so the identity test below actually matches it.
import InlineAutocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { h, computed, onMounted } from 'vue'
import { isMobileView } from '@/composables/settings'

const typeCheck = ['Check']
const typeLink = ['Link', 'Dynamic Link']
const typeNumber = ['Float', 'Int', 'Currency', 'Percent']
// TATVA: an Autocomplete carries the same newline option list a Select does, so it draws the same
// dropdown and takes the same operators. Left out, its value control falls through to a free-text box.
const typeSelect = ['Select', 'Autocomplete']
const typeString = ['Data', 'Long Text', 'Small Text', 'Text Editor', 'Text']
const typeDate = ['Date', 'Datetime']
const typeDuration = ['Duration']
const typeRating = ['Rating']

const props = defineProps({
  doctype: { type: String, required: true },
  // TATVA: icon-only, same prop name and meaning as SortBy.vue's. Absent => stock labelled button.
  hideLabel: { type: Boolean, default: false },
  default_filters: { type: Object, default: () => {} },
  // TATVA: optional caller-supplied field list (same shape as get_filterable_fields:
  // {fieldname, fieldtype, label, options}). When present, this replaces the doctype-meta
  // fetch so the SAME native filter UI drives our Smart Views catalog. Absent/empty => 100%
  // stock (the resource fetch below). Guarded: stock CRM never passes it. See CUSTOMIZATIONS.md.
  fields: { type: Array, default: () => [] },
})

const emit = defineEmits(['update'])

const list = defineModel({ type: Object, default: () => ({}) })

const filterableFields = createResource({
  url: 'crm.api.doc.get_filterable_fields',
  cache: ['filterableFields', props.doctype, LENS_CACHE_GENERATION],
  params: { doctype: props.doctype },
})

// TATVA: the injected catalog wins over the doctype-meta fetch; everything below reads
// fieldData so the component is identical whether fields come from meta or the catalog.
const fieldData = computed(() =>
  props.fields?.length ? props.fields : filterableFields.data,
)

onMounted(() => {
  if (props.fields?.length) return // TATVA: injected fields => no meta fetch
  if (filterableFields.data?.length) return
  filterableFields.fetch()
})

const filters = computed(() => {
  // TATVA: chips read the request's own params, so a filter the server refuses is still removable.
  let allFilters = appliedFilters(list.value)
  if (
    !allFilters ||
    Object.keys(allFilters).length === 0 ||
    !fieldData.value
  )
    return new Set()
  // remove default filters
  if (props.default_filters) {
    allFilters = removeCommonFilters(props.default_filters, allFilters)
  }
  return convertFilters(fieldData.value, allFilters)
})

const availableFilters = computed(() => {
  if (!fieldData.value) return []

  const selectedFieldNames = new Set()
  for (const filter of filters.value) {
    selectedFieldNames.add(filter.fieldname)
  }

  return fieldData.value.filter(
    (field) => !selectedFieldNames.has(field.fieldname),
  )
})

function removeCommonFilters(commonFilters, allFilters) {
  for (const key in commonFilters) {
    if (Object.hasOwn(commonFilters, key) && Object.hasOwn(allFilters, key)) {
      if (commonFilters[key] === allFilters[key]) {
        delete allFilters[key]
      }
    }
  }
  return allFilters
}

function convertFilters(data, allFilters) {
  let f = []
  for (let [key, value] of Object.entries(allFilters)) {
    let field = data.find((f) => f.fieldname === key)
    if (typeof value !== 'object' || !value) {
      value = ['=', value]
      if (field?.fieldtype === 'Check') {
        value = ['equals', value[1] ? 'Yes' : 'No']
      }
    }

    if (field) {
      f.push({
        field,
        fieldname: key,
        operator: oppositeOperatorMap[value[0]],
        value: value[1],
      })
    }
  }
  return new Set(f)
}

function getOperators(fieldtype, fieldname) {
  let options = []
  if (typeString.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Like'), value: 'like' },
        { label: __('Not like'), value: 'not like' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  if (fieldname === '_assign') {
    // TODO: make equals and not equals work
    options = [
      { label: __('Like'), value: 'like' },
      { label: __('Not like'), value: 'not like' },
      { label: __('Is'), value: 'is' },
    ]
  }
  if (typeNumber.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Like'), value: 'like' },
        { label: __('Not like'), value: 'not like' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
        { label: __('<'), value: '<' },
        { label: __('>'), value: '>' },
        { label: __('<='), value: '<=' },
        { label: __('>='), value: '>=' },
      ],
    )
  }
  if (typeSelect.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  if (typeLink.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Like'), value: 'like' },
        { label: __('Not like'), value: 'not like' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  if (typeCheck.includes(fieldtype)) {
    options.push(...[{ label: __('Equals'), value: 'equals' }])
  }
  if (typeDuration.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Like'), value: 'like' },
        { label: __('Not like'), value: 'not like' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  if (typeDate.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Is'), value: 'is' },
        { label: __('>'), value: '>' },
        { label: __('<'), value: '<' },
        { label: __('>='), value: '>=' },
        { label: __('<='), value: '<=' },
        { label: __('Between'), value: 'between' },
        { label: __('Timespan'), value: 'timespan' },
      ],
    )
  }
  if (typeRating.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Greater than'), value: '>' },
        { label: __('Less than'), value: '<' },
        { label: __('Greater than or equal to'), value: '>=' },
        { label: __('Less than or equal to'), value: '<=' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  // TATVA: same narrowing as `_assign` above, keyed off the server descriptor rather than a fieldname.
  return narrowOperators(options, fieldData.value, fieldname)
}

// TATVA: read off the server descriptor, exactly as narrowOperators is — a composite master's picker must offer each label once, and WHICH masters those are is never decided here.
const linkQuery = (fieldname) =>
  fieldData.value?.find((f) => f.fieldname === fieldname)?.link_query || null

function getValueControl(f) {
  // TATVA: ONE control decision, made in `tatva/fieldControl`, shared with the quick filter bar and the
  // Smart View builder. This was a fourteen-branch chain and the bar held a second copy of it, so a grain
  // axis was a plain dropdown in one place and a scoped one in the other, and "is one of" fell through to
  // a free-text box in both — you had to type your own comma-separated list against a field whose values
  // the server already knew.
  const { field, operator } = f
  const { is, props, arity } = resolveControl(
    { ...field, link_query: linkQuery(field.fieldname) },
    operator,
  )
  if (!is) return null
  // frappe-ui's Autocomplete models an OPTION, not a bare value (its own types.ts) — dressed here, and
  // undressed on the way back, so the filter itself only ever holds plain values.
  const opts = props.options || []
  const asOption = (v) => opts.find((o) => o.value === v) || { label: String(v), value: v }
  const undress = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v)
  const bound =
    is === InlineAutocomplete
      ? arity === 'many'
        ? (Array.isArray(f.value) ? f.value : []).map(asOption)
        : f.value === '' || f.value == null
          ? null
          : asOption(f.value)
      : f.value
  const take = (v) =>
    updateValue(Array.isArray(v) ? v.map(undress) : undress(v?.target ? v.target.value : v), f)
  return h(is, {
    ...props,
    // Autocomplete's own trigger is a fixed-height button that truncates its selections (h-7 + truncate).
    // `form-control` overrides that height, so the box grew with every value picked instead of truncating.
    class: is === InlineAutocomplete ? undefined : 'form-control',
    modelValue: bound,
    value: bound,
    'onUpdate:modelValue': take,
    onChange: take,
  })
}

function getDefaultValue(field) {
  if (typeSelect.includes(field.fieldtype)) {
    return getSelectOptions(field.options)[0]
  }
  if (typeCheck.includes(field.fieldtype)) {
    return 'Yes'
  }
  if (typeDate.includes(field.fieldtype)) {
    return null
  }
  return ''
}

function getDefaultOperator(fieldtype) {
  if (typeSelect.includes(fieldtype)) {
    return 'equals'
  }
  if (typeCheck.includes(fieldtype) || typeNumber.includes(fieldtype)) {
    return 'equals'
  }
  if (typeDate.includes(fieldtype)) {
    return 'between'
  }
  return 'like'
}

function getSelectOptions(options) {
  return options.split('\n')
}

function setfilter(data) {
  if (!data) return
  filters.value.add({
    field: {
      label: data.label,
      fieldname: data.fieldname,
      fieldtype: data.fieldtype,
      options: data.options,
    },
    fieldname: data.fieldname,
    operator: getDefaultOperator(data.fieldtype),
    value: getDefaultValue(data),
  })
  apply()
}

function updateFilter(data, index) {
  if (!data.fieldname) return

  filters.value.delete(Array.from(filters.value)[index])
  filters.value.add({
    fieldname: data.fieldname,
    operator: getDefaultOperator(data.fieldtype),
    value: getDefaultValue(data),
    field: {
      label: data.label,
      fieldname: data.fieldname,
      fieldtype: data.fieldtype,
      options: data.options,
    },
  })
  apply()
}

function removeFilter(index) {
  filters.value.delete(Array.from(filters.value)[index])
  apply()
}

function clearfilter(close) {
  filters.value.clear()
  apply()
  close()
}

function updateValue(value, filter) {
  value = value.target ? value.target.value : value
  if (filter.operator === 'between') {
    filter.value = [value.split(',')[0], value.split(',')[1]]
  } else {
    filter.value = value
  }
  apply()
}

function updateOperator(filter) {
  filter.value = getDefaultValue(filter.field)

  if (filter.operator === 'is' || filter.operator === 'is not') {
    filter.value = 'set'
  }
  apply()
}

function apply() {
  let _filters = []
  filters.value.forEach((f) => {
    _filters.push({
      fieldname: f.fieldname,
      operator: f.operator,
      value: f.value,
    })
  })
  emit('update', parseFilters(_filters))
}

function parseFilters(filters) {
  const filtersArray = Array.from(filters)
  const obj = filtersArray.map(transformIn).reduce((p, c) => {
    if (['equals', '='].includes(c.operator)) {
      p[c.fieldname] =
        c.value == 'Yes' ? true : c.value == 'No' ? false : c.value
    } else {
      p[c.fieldname] = [operatorMap[c.operator.toLowerCase()], c.value]
    }
    return p
  }, {})
  const merged = { ...obj }
  return merged
}

function transformIn(f) {
  if (f.operator.includes('like') && !f.value.includes('%')) {
    f.value = `%${f.value}%`
  }
  if (['in', 'not in'].includes(f.operator) && typeof f.value === 'string') {
    f.value = f.value.split(',').map((v) => v.trim())
  }
  return f
}

function placeholder(f) {
  if (f.operator === 'between') {
    return __('01/01/2022 to 01/31/2022')
  } else if (f.operator === 'in' || f.operator === 'not in') {
    if (typeNumber.includes(f.field.fieldtype)) {
      return __('100, 200, 300')
    }
    return __('John, Jane, Doe')
  } else if (f.operator === 'like' || f.operator === 'not like') {
    if (typeNumber.includes(f.field.fieldtype)) {
      return __('%100%')
    }
    return __('%John%')
  } else if (f.operator === 'is' || f.operator === 'is not') {
    return __('Set')
  } else if (f.operator === 'timespan') {
    return __('Last Week')
  } else if (typeNumber.includes(f.field.fieldtype)) {
    return __('1000')
  } else if (typeDate.includes(f.field.fieldtype)) {
    return __('01/01/2022')
  } else if (typeCheck.includes(f.field.fieldtype)) {
    return __('Yes')
  } else if (typeLink.includes(f.field.fieldtype)) {
    return __('Select a Value')
  } else if (typeSelect.includes(f.field.fieldtype)) {
    return __('Select an Option')
  } else if (typeString.includes(f.field.fieldtype)) {
    return __('John Doe')
  }
  return __('Enter Value')
}

const operatorMap = {
  is: 'is',
  'is not': 'is not',
  in: 'in',
  'not in': 'not in',
  equals: '=',
  'not equals': '!=',
  yes: true,
  no: false,
  like: 'LIKE',
  'not like': 'NOT LIKE',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  between: 'between',
  timespan: 'timespan',
}

const oppositeOperatorMap = {
  is: 'is',
  '=': 'equals',
  '!=': 'not equals',
  equals: 'equals',
  'is not': 'is not',
  true: 'yes',
  false: 'no',
  LIKE: 'like',
  'NOT LIKE': 'not like',
  in: 'in',
  'not in': 'not in',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  between: 'between',
  timespan: 'timespan',
}

</script>
