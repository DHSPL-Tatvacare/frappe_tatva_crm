// The `date` and `multi-select` contracts on every declared instance, asserting the STORED config `cohort.next_run_at` reads.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { DatePicker } from 'frappe-ui'

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveSteps', () => ({ useLiveSteps: () => ({ activeNodes: { value: {} } }) }))

import { mountTatva } from './_mount'
import { mockFrappeMethod, mockGraphContext } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'
import FieldPicker from '@/tatva/FieldPicker.vue'
import { NODE_TYPES, instancesOf } from './_matrix'

// DatePicker draws its input in Popover's `#target` slot, which the shared overlay stub does not render.
const PopoverWithTarget = {
  name: 'PopoverStub',
  template: '<div data-stub="Popover"><slot name="target" :togglePopover="() => {}" :isOpen="false" /><slot :open="false" /></div>',
}

const nodeId = (type) => `${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-1`
const declared = (t) => NODE_TYPES.find((n) => n.type === t.node).config.find((f) => f.name === t.field)

async function openNode(type, config, editable = true) {
  mockFrappeMethod('tatva_connect.workflow_engine.registry.node_types', NODE_TYPES)
  mockGraphContext({ subject: 'CRM Lead', variables: [], settable: [], operators_by_type: {}, operator_shapes: {} })
  const id = nodeId(type)
  const w = mountTatva(WorkflowCanvas, {
    props: {
      definition: {
        name: 'WF-CONTROLS',
        canvas_json: null,
        nodes: [{ node_id: id, node_type: type, config_json: JSON.stringify(config), edges: [] }],
      },
      editable,
      problems: [],
    },
    global: { stubs: { Popover: PopoverWithTarget } },
  })
  await flushPromises()
  w.vm.selectedId = id
  await flushPromises()
  return w.findComponent(NodeInspector)
}

// The ONE control of this kind in a row headed by this label; the Trigger's `mode` is also labelled "Starts on".
function controlFor(panel, label, Component) {
  const rows = panel.findAll('span').filter((s) => s.text() === label).map((s) => s.element.parentElement.parentElement)
  const found = panel.findAllComponents(Component).filter((c) => rows.some((row) => row.contains(c.element)))
  expect(found.length, `expected one ${Component.name} under "${label}"`).toBe(1)
  return found[0]
}

const lastConfig = (panel) => JSON.parse(panel.emitted('update:config').at(-1)[0])

describe('date — a calendar day, stored in the shape the scheduler reads', () => {
  const dates = instancesOf('date')

  it('there is a date to judge', () => expect(dates.length).toBeGreaterThan(0))

  for (const t of dates) {
    const label = declared(t).label

    it(`${t.node}.${t.field} stores a typed day as YYYY-MM-DD`, async () => {
      const panel = await openNode(t.node, t.opens)
      const input = controlFor(panel, label, DatePicker).find('input')
      await input.trigger('focus')
      await input.setValue('2026-11-05')
      await input.trigger('blur')
      expect(lastConfig(panel)[t.field]).toBe('2026-11-05')
    })

    it(`${t.node}.${t.field} reads a saved day back`, async () => {
      const panel = await openNode(t.node, { ...t.opens, [t.field]: '2026-11-05' })
      expect(controlFor(panel, label, DatePicker).find('input').element.value).toBe('2026-11-05')
    })

    it(`${t.node}.${t.field} stores a cleared day as ABSENT, never ''`, async () => {
      const panel = await openNode(t.node, { ...t.opens, [t.field]: '2026-11-05' })
      const input = controlFor(panel, label, DatePicker).find('input')
      await input.trigger('focus')
      await input.setValue('')
      await input.trigger('blur')
      expect(lastConfig(panel)).not.toHaveProperty(t.field)
    })

    it(`${t.node}.${t.field} is disabled when the workflow is not editable`, async () => {
      const panel = await openNode(t.node, t.opens, false)
      expect(controlFor(panel, label, DatePicker).find('input').attributes('disabled')).toBeDefined()
    })
  }
})

describe('multi-select — the server’s options, stored as the list of picked values', () => {
  const multis = instancesOf('multi-select')

  it('there is a multi-select to judge', () => expect(multis.length).toBeGreaterThan(0))

  for (const t of multis) {
    const field = declared(t)

    it(`${t.node}.${t.field} offers exactly the declared options, in the server's order`, async () => {
      const panel = await openNode(t.node, t.opens)
      const picker = controlFor(panel, field.label, FieldPicker)
      expect(picker.props('multiple')).toBe(true)
      expect(picker.props('options').map((o) => o.value)).toEqual(field.options)
    })

    it(`${t.node}.${t.field} stores the picked values as bare keys`, async () => {
      const panel = await openNode(t.node, t.opens)
      const picker = controlFor(panel, field.label, FieldPicker)
      const [first, , third] = picker.props('options')
      await picker.vm.$emit('update:modelValue', [first, third])
      expect(lastConfig(panel)[t.field]).toEqual([field.options[0], field.options[2]])
    })

    it(`${t.node}.${t.field} reads a saved list back`, async () => {
      const saved = [field.options[1]]
      const panel = await openNode(t.node, { ...t.opens, [t.field]: saved })
      expect(controlFor(panel, field.label, FieldPicker).props('modelValue')).toEqual(saved)
    })

    it(`${t.node}.${t.field} stores an emptied selection as ABSENT, never []`, async () => {
      const panel = await openNode(t.node, { ...t.opens, [t.field]: [field.options[1]] })
      await controlFor(panel, field.label, FieldPicker).vm.$emit('update:modelValue', [])
      expect(lastConfig(panel)).not.toHaveProperty(t.field)
    })

    it(`${t.node}.${t.field} is disabled when the workflow is not editable`, async () => {
      const panel = await openNode(t.node, t.opens, false)
      expect(controlFor(panel, field.label, FieldPicker).props('disabled')).toBe(true)
    })
  }
})
