// TATVA: the ⌘K query builder's rows — field → operator → value builds each condition, then the list opens with them or a bulk action runs through the list's own door.
import router from '@/router'
import { createResource, toast } from 'frappe-ui'
import { reactive } from 'vue'
import { usersStore } from '@/stores/users'
import { arityOf, valuesOf } from '@/tatva/fieldControl'
import { getOperators } from '@/tatva/filterOperators'
import { LENS_CACHE_GENERATION } from '@/tatva/lensCache'
import { useBulkJob } from '@/tatva/useBulkJob'
import { timespanOptions } from '@/utils/timespanOptions'
import LucideCheck from '~icons/lucide/check'
import LucideLayoutList from '~icons/lucide/layout-list'
import LucideListFilter from '~icons/lucide/list-filter'
import LucidePencil from '~icons/lucide/pencil'
import LucideUserMinus from '~icons/lucide/user-minus'
import LucideUserPlus from '~icons/lucide/user-plus'
import LucideUserRoundCog from '~icons/lucide/user-round-cog'
import LucideX from '~icons/lucide/x'
import {
  addCondition,
  conditions,
  matchCount,
  matchingNames,
  MAX_BULK,
  queryFilters,
  QUERY_TAG,
  startQuery,
  target,
} from './queryBuilder'
import { listHandle } from './published'
import { levels, popTo, query } from './usePalette'

// The task list offers no Assign (TasksListView `hideAssign`), so neither does its builder.
const LISTS = {
  'CRM Lead': {
    route: 'Leads',
    title: 'Filter leads',
    one: 'lead',
    many: 'leads',
    assign: true,
    // The Leads page's own `:filters` (Leads.vue), so the count and the bulk rows are the list's rows.
    defaults: { converted: 0 },
  },
  'CRM Task': {
    route: 'Tasks',
    title: 'Filter tasks',
    one: 'task',
    many: 'tasks',
    assign: false,
  },
}

const GROUP_QUERY = 'Query'
const GROUP_ACTIONS = 'Actions'
const GROUP_FIELDS = 'Add a condition'

// The fieldtypes a palette row can hold a value for; the rest stay in the list's Edit dialog.
const EDITABLE = [
  'Data',
  'Phone',
  'Small Text',
  'Text',
  'Long Text',
  'Select',
  'Autocomplete',
  'Link',
  'Check',
  'Int',
  'Float',
  'Currency',
  'Percent',
  'Date',
  'Datetime',
]

// The filter bar's own field list and cache key, so the builder offers exactly what the bar offers.
const filterable = {}
function filterableFields(doctype) {
  return (filterable[doctype] ??= createResource({
    url: 'crm.api.doc.get_filterable_fields',
    cache: ['filterableFields', doctype, LENS_CACHE_GENERATION],
    params: { doctype },
  }))
}

// Bulk Edit's own field source (EditValueModal), under a key of ours since that one caches its filtered copy.
const editable = {}
function editableFields(doctype) {
  return (editable[doctype] ??= createResource({
    url: 'crm.api.doc.get_fields',
    cache: ['tatva:palette-edit-fields', doctype],
    params: { doctype },
  }))
}

// A Link's values through the filter bar's own lookup (read permission + User Permissions), one cached resource per field.
const links = {}
async function linkOptions(field, source) {
  const doctype = target.value.doctype
  const resource = (links[`${doctype}:${field.fieldname}`] ??= createResource({
    url: 'frappe.desk.search.search_link',
    params: {
      doctype: source.doctype,
      txt: '',
      page_length: 500,
      query: source.query || undefined,
      reference_doctype: doctype,
      link_fieldname: field.fieldname,
    },
    cache: ['tatva:palette-link', doctype, field.fieldname],
  }))
  return (await ensure(resource)).map((r) => ({
    value: r.value,
    label: r.label || r.value,
  }))
}

async function ensure(resource) {
  if (!resource.data) await resource.fetch()
  return resource.data || []
}

const builderDepth = () =>
  levels.value.findIndex((level) => level.tag === QUERY_TAG) + 1
const noun = (n) => __(n === 1 ? target.value.one : target.value.many)
const blank = (v) =>
  v === '' ||
  v == null ||
  (Array.isArray(v) && (!v.length || v.some((x) => x === '')))
// A run that needs a value stops with a reason the palette's toast reads.
const refuse = (message) => {
  throw { messages: [message] }
}

// Desktop root rows: one per list. The caller gates on the layout.
export function queryRootCommands() {
  return Object.entries(LISTS).map(([doctype, list]) => ({
    id: `query-${doctype}`,
    title: __(`${list.title}…`),
    group: GROUP_QUERY,
    icon: LucideListFilter,
    keywords: 'query filter builder where find bulk assign reassign edit',
    levelTitle: __(list.title),
    levelTag: QUERY_TAG,
    children: async () => {
      startQuery({ doctype, ...list })
      await ensure(filterableFields(doctype))
      return builderRows
    },
  }))
}

// The builder level, live: the actions once a condition exists, then every field not yet used.
function builderRows() {
  const list = target.value
  if (!list) return []
  const taken = new Set(conditions.value.map((c) => c.field.fieldname))
  const fields = (filterableFields(list.doctype).data || []).filter(
    (f) => !taken.has(f.fieldname),
  )
  return [
    ...(conditions.value.length ? actionRows(list) : []),
    ...fields.map((field) => ({
      id: `query-field-${field.fieldname}`,
      title: field.label,
      group: GROUP_FIELDS,
      keywords: field.fieldname,
      levelTitle: field.label,
      children: () => operatorStep(field, list.doctype),
    })),
  ]
}

// One operator skips the step; otherwise each operator drills into its values.
function operatorStep(field, doctype) {
  const operators = getOperators(
    field.fieldtype,
    field.fieldname,
    filterableFields(doctype).data,
  )
  if (!operators.length)
    refuse(__('{0} cannot be filtered here', [field.label]))
  if (operators.length === 1)
    return valueRows(
      field,
      operators[0].value,
      conditionPick(field, operators[0]),
    )
  return operators.map((op) => ({
    id: `query-op-${op.value}`,
    title: op.label,
    levelTitle: `${field.label} ${op.label.toLowerCase()}`,
    children: () => valueRows(field, op.value, conditionPick(field, op)),
  }))
}

// Choosing a value adds the condition and returns to the builder, where the count updates.
function conditionPick(field, op) {
  return (getValue, getLabel) => ({
    stay: true,
    perform: () => {
      const value = getValue()
      if (blank(value)) return
      addCondition({
        field,
        operator: op.value,
        value,
        label: `${field.label} ${op.label.toLowerCase()} ${getLabel()}`,
      })
      popTo(builderDepth())
    },
  })
}

// The values for one field and operator; `pick(getValue, getLabel)` decides what choosing one does.
function valueRows(field, operator, pick) {
  const op = String(operator).toLowerCase()
  if (op === 'is')
    return optionRows(
      [
        { label: __('Set'), value: 'set' },
        { label: __('Not set'), value: 'not set' },
      ],
      pick,
    )
  if (op === 'timespan') return optionRows(timespanOptions, pick)
  const source = ['like', 'not like', 'between'].includes(op)
    ? { kind: 'free' }
    : valuesOf(field)
  const many = arityOf(op) === 'many'
  if (source.kind === 'inline')
    return many
      ? multiRows(source.options, pick)
      : optionRows(source.options, pick)
  if (source.kind === 'search') {
    // Only a value the server returned: a typed name can miss a `::` key and match nothing, silently.
    return linkOptions(field, source).then((options) =>
      many ? multiRows(options, pick) : optionRows(options, pick),
    )
  }
  return [typedRow(field, op, pick)]
}

function optionRows(options, pick) {
  return options.map((o) => ({
    id: `query-value-${o.value}`,
    title: __(o.label),
    ...pick(
      () => o.value,
      () => __(o.label),
    ),
  }))
}

// Several values: rows tick in place, the first row takes them. Rank 0 keeps it first until typing, then last.
function multiRows(options, pick) {
  // Reactive, so the live level re-reads the ticks.
  const chosen = reactive(new Set())
  const labelOf = (v) =>
    __(options.find((o) => o.value === v)?.label ?? String(v))
  const take = pick(
    () => [...chosen],
    () => [...chosen].map(labelOf).join(', '),
  )
  return () => [
    {
      id: 'query-multi-done',
      rank: 0,
      title: chosen.size
        ? __('Use {0} selected', [chosen.size])
        : __('Pick one or more'),
      icon: LucideCheck,
      ...(chosen.size ? take : { stay: true, perform: () => {} }),
    },
    ...options.map((o) => ({
      id: `query-value-${o.value}`,
      title: __(o.label),
      checked: chosen.has(o.value),
      stay: true,
      perform: () => {
        if (chosen.has(o.value)) chosen.delete(o.value)
        else chosen.add(o.value)
        query.value = ''
      },
    })),
  ]
}

// A value typed into the palette's own input; `between` takes two, comma-separated.
function typedRow(field, op, pick) {
  const read = () => {
    const typed = query.value.trim()
    return op === 'between'
      ? typed.split(',').map((part) => part.trim())
      : typed
  }
  const hint = ['Date', 'Datetime'].includes(field.fieldtype)
    ? op === 'between'
      ? 'YYYY-MM-DD, YYYY-MM-DD'
      : 'YYYY-MM-DD'
    : ''
  return {
    id: 'query-typed',
    rank: 0,
    get title() {
      const typed = query.value.trim()
      return typed ? __('Use "{0}"', [typed]) : __('Type a value…')
    },
    subtitle: hint,
    icon: LucidePencil,
    ...pick(read, () => query.value.trim()),
  }
}

// The four list actions, each the list's own; past the server's cap they say so instead.
function actionRows(list) {
  const n = matchCount.value
  const over = n != null && n > MAX_BULK
  const bulk = (row) =>
    over
      ? {
          ...row,
          children: undefined,
          subtitle: __('Over {0}', [MAX_BULK]),
          stay: true,
          perform: () =>
            toast.warning(
              __('Narrow the filter to {0} or fewer to run a bulk action.', [
                MAX_BULK,
              ]),
            ),
        }
      : row
  return [
    {
      id: 'query-open-list',
      title: __('Open in list'),
      subtitle: n == null ? '' : `${n} ${noun(n)}`,
      group: GROUP_ACTIONS,
      icon: LucideLayoutList,
      perform: () =>
        router.push({
          name: list.route,
          params: { viewType: 'list' },
          query: { filters: JSON.stringify(queryFilters()) },
        }),
    },
    ...(list.assign
      ? [
          bulk({
            id: 'query-assign',
            title: __('Assign to…'),
            group: GROUP_ACTIONS,
            icon: LucideUserPlus,
            levelTitle: __('Assign to'),
            children: () => peopleRows('Assign'),
          }),
          bulk({
            id: 'query-reassign',
            title: __('Reassign to…'),
            group: GROUP_ACTIONS,
            icon: LucideUserRoundCog,
            levelTitle: __('Reassign to'),
            children: () => peopleRows('Reassign'),
          }),
          bulk({
            id: 'query-clear-assignment',
            title: __('Clear assignment'),
            group: GROUP_ACTIONS,
            icon: LucideUserMinus,
            levelTitle: __('Clear assignment'),
            children: () =>
              confirmRows('Clear Assignment', {}, (count) =>
                __('Clear assignment on {0} {1}', [count, noun(count)]),
              ),
          }),
        ]
      : []),
    bulk({
      id: 'query-edit',
      title: __('Edit field…'),
      group: GROUP_ACTIONS,
      icon: LucidePencil,
      levelTitle: __('Edit field'),
      children: () => editFieldRows(list.doctype),
    }),
  ]
}

// The list's own assignee list (AssignmentModal's `crmUsers`); one person per action.
function peopleRows(action) {
  const people = usersStore().users.data?.crmUsers || []
  return people.map((user) => {
    const name = user.full_name || user.name
    return {
      id: `query-person-${user.name}`,
      title: name,
      subtitle: user.full_name && user.full_name !== user.name ? user.name : '',
      avatar: { image: user.user_image, label: name },
      levelTitle: __('Confirm'),
      children: () =>
        confirmRows(action, { assign_to: [user.name] }, (count) =>
          action === 'Reassign'
            ? __('Reassign {0} {1} to {2}', [count, noun(count), name])
            : __('Assign {0} {1} to {2}', [count, noun(count), name]),
        ),
    }
  })
}

// Bulk Edit's fields as its dialog lists them: visible and writable.
async function editFieldRows(doctype) {
  const fields = (await ensure(editableFields(doctype))).filter(
    (f) => f.hidden == 0 && f.read_only == 0 && EDITABLE.includes(f.fieldtype),
  )
  return fields.map((field) => ({
    id: `query-edit-${field.fieldname}`,
    title: field.label,
    keywords: field.fieldname,
    levelTitle: field.label,
    children: () =>
      valueRows(field, 'equals', (getValue, getLabel) => ({
        levelTitle: __('Confirm'),
        children: () => {
          const value = getValue()
          if (blank(value)) refuse(__('Type a value first'))
          // The dialog's own payload: an empty value clears the field.
          return confirmRows(
            'Bulk Edit',
            { field: field.fieldname, value: value || null },
            (count) =>
              __('Set {0} to "{1}" on {2} {3}', [
                field.label,
                getLabel(),
                count,
                noun(count),
              ]),
          )
        },
      })),
  }))
}

// The names are read fresh at confirm, so the job acts on what matches now; the sentence states the count.
async function confirmRows(action, params, sentence) {
  const names = await matchingNames()
  if (!names.length) refuse(__('No {0} match', [noun(0)]))
  const doctype = target.value.doctype
  return [
    {
      id: 'query-confirm',
      title: sentence(names.length),
      icon: LucideCheck,
      perform: () =>
        useBulkJob()
          // The list on screen reloads when the job ends, as its own bulk menu does.
          .runOrQueue(action, doctype, names, params, () =>
            listHandle.value?.reload?.(),
          )
          // Surfaced: the server's own reason, as the list's bulk actions show it.
          .catch((error) =>
            toast.error(
              error?.messages?.[0] || __('Could not start {0}', [__(action)]),
            ),
          ),
    },
    {
      id: 'query-cancel',
      title: __('Cancel'),
      icon: LucideX,
      stay: true,
      perform: () => popTo(builderDepth()),
    },
  ]
}
