// Purpose: SmartViewSheet is the MOBILE Smart View picker — a collapsed "current view" trigger that
// opens a TatvaBottomSheet listing every view. What it adds over its children (TatvaBottomSheet's
// open/close/backdrop and SmartViewTabs' tab strip, both already tested) is: resolving the active view
// for the trigger, wiring the store count through formatCount into the trigger + per-row pills, the
// open-on-trigger / close-on-action model, and the selection emit contract. Those are what this spec
// pins; child behaviours are not re-tested here.
// Authoring (create/edit) is DESKTOP-ONLY by decision — see the last test, which pins the absence.
import { describe, it, expect, vi } from 'vitest'
import { mountTatva } from './_mount.js'

// Mock the Pinia store at the boundary (mirror SmartViewTabs.test.js). Here getCount returns a real
// count for the active view so the formatCount → pill wiring is genuinely exercised (SmartViewTabs
// stubbed it to null and never hit formatCount); other views are "not loaded yet" (null = no pill).
vi.mock('@/stores/smartViews', () => {
  const counts = { 'sv-leads': 13260 } // 13260 -> "13.26K" via formatCount
  return {
    smartViewsStore: () => ({
      getCount: (name) => (name in counts ? counts[name] : null),
    }),
  }
})

import SmartViewSheet from '@/tatva/SmartViewSheet.vue'

const views = [
  { name: 'sv-leads', label: 'My Leads', icon: 'users', can_write: 1 },
  { name: 'sv-acts', label: 'Open Tasks', icon: 'check-square', can_write: 0 },
]

// The collapsed trigger is the only button before the sheet opens; clicking it opens the bottom sheet.
const openSheet = (wrapper) => wrapper.get('button').trigger('click')

describe('SmartViewSheet', () => {
  it('collapses to the active view label and does not render the view list until opened', () => {
    const wrapper = mountTatva(SmartViewSheet, { props: { views, modelValue: 'sv-leads' } })
    expect(wrapper.get('button').text()).toContain('My Leads') // active resolved onto the trigger
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false) // sheet closed -> no list
    expect(wrapper.text()).not.toContain('Open Tasks') // the other view is hidden while collapsed
  })

  it('falls back to "Select a view" when modelValue matches no view', () => {
    const wrapper = mountTatva(SmartViewSheet, { props: { views, modelValue: 'nope' } })
    expect(wrapper.get('button').text()).toContain('Select a view')
  })

  it('opens the bottom sheet with one row per view and marks the active row', async () => {
    const wrapper = mountTatva(SmartViewSheet, { props: { views, modelValue: 'sv-leads' } })
    await openSheet(wrapper)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    const rows = wrapper.findAll('li')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('My Leads')
    expect(wrapper.text()).toContain('Open Tasks')
    // the active view's select button carries the selected-state class; the inactive one does not
    expect(rows[0].get('button').classes()).toContain('bg-surface-gray-2')
    expect(rows[1].get('button').classes()).not.toContain('bg-surface-gray-2')
  })

  it('formats the store count into the trigger pill and the active row pill', async () => {
    const wrapper = mountTatva(SmartViewSheet, { props: { views, modelValue: 'sv-leads' } })
    expect(wrapper.get('button').text()).toContain('13.26K') // activeCount via getCount -> formatCount
    await openSheet(wrapper)
    const rows = wrapper.findAll('li')
    expect(rows[0].text()).toContain('13.26K') // per-row count bubble for the loaded view
    expect(rows[1].text()).not.toMatch(/\d/) // unloaded view (getCount null) shows no count bubble
  })

  it('emits update:modelValue with the picked view and closes the sheet', async () => {
    const wrapper = mountTatva(SmartViewSheet, { props: { views, modelValue: 'sv-leads' } })
    await openSheet(wrapper)
    await wrapper.findAll('li')[1].get('button').trigger('click') // pick "Open Tasks"
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['sv-acts'])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false) // selection closes the sheet
  })

  // AUTHORING IS DESKTOP-ONLY, AND THAT IS A DECISION — not an omission waiting to be filled in.
  // The sheet is a PICKER. Create/edit belong to SmartViewTabs and the page header's Create button,
  // both of which render behind `v-if="!isMobileView"`. On a phone the editor drawer is clunky and
  // oversized, so the affordance is withheld rather than shipped badly.
  // This test exists so the buttons cannot drift back in: it fails the moment the sheet grows one.
  it('offers NO create or edit affordance — authoring is desktop-only, deliberately', async () => {
    const wrapper = mountTatva(SmartViewSheet, { props: { views, modelValue: 'sv-leads' } })
    await openSheet(wrapper)

    expect(wrapper.findAll('button[aria-label="Edit view"]')).toHaveLength(0)
    expect(
      wrapper.findAll('button').some((b) => b.text().includes('New Smart View')),
    ).toBe(false)
  })
})
