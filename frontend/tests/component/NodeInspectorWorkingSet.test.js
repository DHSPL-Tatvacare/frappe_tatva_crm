// W3.1 through the REAL chain: Trigger config → node_context → NodeInspector → the pickers below it.
// `workingSet.test.js` proves the narrowing rule; this proves it is WIRED — that a set declared on the
// Trigger reaches a picker six nodes away, that it never becomes a wall, and that it cannot break a
// workflow that already references a field outside it.
//
// The `variables`/`settable` payload is the GENERATED wire fixture, so the `<source><SEP><key>`
// composition every assertion depends on came out of refs.py and not out of this file.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Autocomplete } from 'frappe-ui'

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveSteps', () => ({ useLiveSteps: () => ({ activeNodes: { value: {} } }) }))

import { mountTatva } from './_mount'
import { mockFrappeMethod, mockGraphContext } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'
import FieldMap from '@/tatva/workflows/FieldMap.vue'
import wire from '../fixtures/nodeContext.wire.json'

const NODE_TYPES = [
  {
    type: 'Trigger',
    label: 'Trigger',
    description: 'What starts this workflow.',
    outputs: ['next'],
    outcomes: [],
    config: [
      { name: 'subject_doctype', label: 'Subject', type: 'Select', control: 'select',
        options: ['CRM Lead'], primitive: true, summary: null, shapes_outputs: false },
      { name: 'working_set', label: 'Fields used', type: 'Field Set', control: 'field-set',
        primitive: false, summary: { count: 'fields' }, shapes_outputs: false,
        placeholder: 'Every field on the subject' },
    ],
  },
  {
    // Present because the wire fixture carries the values it emits. `node_context` only ever returns a
    // variable whose source node is really in the graph, so a test graph that omitted it would be a state
    // production cannot reach — and would "prove" a narrowing bug that does not exist.
    type: 'Call API',
    label: 'Call API',
    description: 'Calls a curated endpoint.',
    outputs: ['succeeded', 'failed'],
    outcomes: [],
    config: [],
  },
  {
    type: 'Update Field',
    label: 'Update Field',
    description: 'Writes a value onto a field.',
    outputs: ['next'],
    outcomes: [],
    config: [
      // W8.1 — the write side is the row control, not a flat picker; it takes the narrowed rows as PROPS.
      { name: 'updates', label: 'Fields to set', type: 'Field Map', control: 'field-map',
        modes: ['Literal', 'From Context'],
        mode_controls: { Literal: 'data', 'From Context': 'value-picker' },
        primitive: false, summary: null, shapes_outputs: false },
      { name: 'value', label: 'Value', type: 'Variable', control: 'value-picker',
        primitive: false, summary: null, shapes_outputs: false },
    ],
  },
  { type: 'Terminal', label: 'End', description: 'Ends the run.', outputs: [], outcomes: [], config: [] },
]

// Two fields the fixture proves are both readable AND writable, so one set narrows both directions.
const DECLARED = 'custom_patient_age'
const OTHER_WRITABLE = 'custom_substage'

function definition(workingSet, updateConfig = {}) {
  return {
    name: 'WF-WORKING-SET',
    canvas_json: null,
    nodes: [
      { node_id: 'trigger-1', node_type: 'Trigger',
        config_json: JSON.stringify({ subject_doctype: 'CRM Lead', ...(workingSet ? { working_set: workingSet } : {}) }),
        edges: [{ from_output: 'next', to_node: 'call-api-1' }] },
      { node_id: 'call-api-1', node_type: 'Call API', config_json: '{}',
        edges: [{ from_output: 'succeeded', to_node: 'update-1' }] },
      { node_id: 'update-1', node_type: 'Update Field', config_json: JSON.stringify(updateConfig),
        edges: [{ from_output: 'next', to_node: 'end-1' }] },
      { node_id: 'end-1', node_type: 'Terminal', config_json: '{}', edges: [] },
    ],
  }
}

async function open(nodeId, workingSet, updateConfig) {
  mockFrappeMethod('tatva_connect.workflow_engine.registry.node_types', NODE_TYPES)
  mockFrappeMethod('tatva_connect.workflow_engine.history.node_counts', {})
  mockGraphContext({
    outputs: {
      'trigger-1': ['next'], 'call-api-1': ['succeeded', 'failed'], 'update-1': ['next'], 'end-1': [],
    },
    subject: wire.subject,
    grain: {},
    // The backend ANSWERS the set and filters nothing — the whole guarantee of W3.1.
    working_set: workingSet || [],
    variables: wire.variables,
    settable: wire.settable,
    emitters: [],
    operators_by_type: {},
    operator_shapes: {},
  })

  const wrapper = mountTatva(WorkflowCanvas, {
    props: { definition: definition(workingSet, updateConfig), editable: true, problems: [] },
  })
  await flushPromises()
  wrapper.vm.selectedId = nodeId
  await flushPromises()
  await new Promise((r) => setTimeout(r, 350)) // NodeInspector debounces node_context by 300ms
  await flushPromises()
  return wrapper.findComponent(NodeInspector)
}

// The WRITE side is FieldMap's `fieldRows` prop — flat rows it groups itself, so this reads the narrowing at the seam rather than through a row the author has not added yet.
const writeOptions = (inspector) =>
  inspector.findComponent(FieldMap).props('fieldRows').map((r) => r.value)

// The READ side is still a flat value-picker; FieldMap's own inputs use the app's Autocomplete, not frappe-ui's, so this never matches one of them.
const readPicker = (inspector) => inspector.findAllComponents(Autocomplete)[0]
const readOptions = (inspector) =>
  readPicker(inspector).props('options').flatMap((g) => g.items.map((it) => it.value))

describe('W3.1 — a set declared on the Trigger narrows the pickers below it', () => {
  it('offers the whole schema when nothing is declared (rule 1)', async () => {
    const inspector = await open('update-1', null)

    expect(writeOptions(inspector)).toContain(OTHER_WRITABLE)
    expect(readOptions(inspector).length).toBe(wire.variables.length)
  })

  it('narrows BOTH the write picker and the read picker from one declaration', async () => {
    const inspector = await open('update-1', [DECLARED])

    expect(writeOptions(inspector)).toEqual([DECLARED])
    const reads = readOptions(inspector)
    expect(reads).toContain(`${wire.variables[0].source}.${DECLARED}`)
    expect(reads).not.toContain(`${wire.variables[0].source}.${OTHER_WRITABLE}`)
  })

  it('never narrows a value a NODE produced (rule 2)', async () => {
    const inspector = await open('update-1', [DECLARED])
    const reads = readOptions(inspector)

    for (const v of wire.variables.filter((v) => v.emitted)) {
      expect(reads).toContain(v.ref)
    }
  })

  it('still renders a saved reference the set does not name (rule 3)', async () => {
    const outsider = wire.variables.find(
      (v) => v.source === wire.variables[0].source && !v.ref.endsWith(DECLARED),
    )
    const inspector = await open('update-1', [DECLARED], { value: outsider.ref })

    // groupedOptions prepends what nothing offers any more, so the author still sees what is wired.
    const reads = readOptions(inspector)
    expect(reads).toContain(outsider.ref)
  })

  it('shows an out-of-set reference by its LABEL, not as a raw ref', async () => {
    // Caught in a browser, not by a suite: the reference survived the narrowing exactly as rule 3 says,
    // and then rendered as `crm_lead.mobile_no`. Still resolving, no longer legible. A field the set does
    // not name is not a DEAD reference and must not be reported as one.
    const outsider = wire.variables.find(
      (v) => v.source === wire.variables[0].source && !v.ref.endsWith(DECLARED),
    )
    const inspector = await open('update-1', [DECLARED], { value: outsider.ref })

    const prepended = readPicker(inspector).props('options')[0]
    expect(prepended.items[0].label).toBe(outsider.label)
    expect(prepended.group).not.toBe('No longer available')
  })

  it('offers a way back to the whole schema, and it is never a wall (rule 4)', async () => {
    const inspector = await open('update-1', [DECLARED])
    // Each picker owns its OWN hatch — widening the write picker must not silently widen the read one —
    // so this scopes to the read picker's block rather than taking whichever button comes first.
    const block = inspector.findAll('[data-test="value-picker"]')[0]
    const toggle = block.findAll('button').find((b) => b.text().includes('Show all fields'))
    expect(toggle, 'the escape hatch must be offered while the set is hiding rows').toBeTruthy()

    await toggle.trigger('click')
    expect(readOptions(inspector).length).toBe(wire.variables.length)
    // and the write picker, untouched, is still narrowed
    expect(writeOptions(inspector)).toEqual([DECLARED])
  })

  it('offers no escape hatch when nothing is hidden', async () => {
    const inspector = await open('update-1', null)
    expect(inspector.findAll('button').some((b) => b.text().includes('Show all fields'))).toBe(false)
  })
})

describe('W3.1 — the Trigger control itself', () => {
  it('offers subject fields only, deduped, and stores bare keys in declaration order', async () => {
    const inspector = await open('trigger-1', null)
    const control = inspector.findAllComponents(Autocomplete).at(-1)
    const values = control.props('options').flatMap((g) => g.items.map((i) => i.value))

    expect(values.filter((v) => v === OTHER_WRITABLE)).toHaveLength(1) // the wire sends it twice
    expect(values.every((v) => !v.includes('.'))).toBe(true) // bare keys, never namespaced refs

    control.vm.$emit('update:modelValue', [{ value: DECLARED }, { value: OTHER_WRITABLE }])
    await flushPromises()
    const saved = JSON.parse(inspector.emitted('update:config').at(-1)[0])
    expect(saved.working_set).toEqual([DECLARED, OTHER_WRITABLE]) // selection order is the order
  })

  it('stores an emptied set as ABSENT, so "no restriction" has one representation', async () => {
    const inspector = await open('trigger-1', [DECLARED])
    const control = inspector.findAllComponents(Autocomplete).at(-1)

    control.vm.$emit('update:modelValue', [])
    await flushPromises()
    const saved = JSON.parse(inspector.emitted('update:config').at(-1)[0])
    expect(saved.working_set).toBeUndefined()
  })
})
