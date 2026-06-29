// Purpose: one synthetic audit row must render exactly what the server assembler decided — actor name,
// the activity_type's verb, the subject — and branch correctly per type: a stage_moved row shows the
// from->to pair, a logged activity folds in its status/location/document detail, and an automation-driven
// row is badged. Pure presentation (no emit); these assertions guard the type routing in Activities.vue.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import ActivityAuditEntry from '@/tatva/ActivityAuditEntry.vue'

describe('ActivityAuditEntry', () => {
  it('renders actor, the type verb and subject for a logged activity', () => {
    const wrapper = mountTatva(ActivityAuditEntry, {
      props: {
        activity: {
          owner_name: 'Asha Rao',
          activity_type: 'activity_logged',
          subject: 'Home Visit',
          creation: '2026-06-01 10:00:00',
        },
      },
    })
    expect(wrapper.text()).toContain('Asha Rao')
    expect(wrapper.text()).toContain('logged') // VERBS.activity_logged default verb
    expect(wrapper.text()).toContain('Home Visit')
  })

  it('honours a server-supplied verb over the activity_logged default', () => {
    const wrapper = mountTatva(ActivityAuditEntry, {
      props: {
        activity: {
          owner_name: 'Asha Rao',
          activity_type: 'activity_logged',
          verb: 'phoned',
          subject: 'Patient',
          creation: '2026-06-01 10:00:00',
        },
      },
    })
    expect(wrapper.text()).toContain('phoned')
    expect(wrapper.text()).not.toContain('logged')
  })

  it('shows the from->to pair for a stage move', () => {
    const wrapper = mountTatva(ActivityAuditEntry, {
      props: {
        activity: {
          owner_name: 'Asha Rao',
          activity_type: 'stage_moved',
          from_stage: 'New',
          to_stage: 'Engaged',
          creation: '2026-06-01 10:00:00',
        },
      },
    })
    expect(wrapper.text()).toContain('moved stage')
    expect(wrapper.text()).toContain('New')
    expect(wrapper.text()).toContain('Engaged')
    expect(wrapper.find('[data-feather="arrow-right"]').exists() || wrapper.html().includes('arrow-right')).toBe(true)
  })

  it('badges an automation-driven entry', () => {
    const wrapper = mountTatva(ActivityAuditEntry, {
      props: {
        activity: {
          owner_name: 'System',
          is_automation: true,
          activity_type: 'task_created',
          subject: 'Schedule call',
          creation: '2026-06-01 10:00:00',
        },
      },
    })
    expect(wrapper.text()).toContain('Automation')
    expect(wrapper.text()).toContain('created task')
  })

  it('folds in status, location and document detail for a logged activity', () => {
    const wrapper = mountTatva(ActivityAuditEntry, {
      props: {
        activity: {
          owner_name: 'Asha Rao',
          activity_type: 'activity_logged',
          subject: 'Home Visit',
          creation: '2026-06-01 10:00:00',
          status: 'Completed',
          location: { map_url: 'https://maps.example/x', address: '12 MG Road' },
          documents: [{ file_url: '/files/report.pdf', file_name: 'report.pdf' }],
        },
      },
    })
    expect(wrapper.text()).toContain('Completed')
    const mapLink = wrapper.get('a[href="https://maps.example/x"]')
    expect(mapLink.text()).toContain('12 MG Road')
    const docLink = wrapper.get('a[href="/files/report.pdf"]')
    expect(docLink.text()).toContain('report.pdf')
  })

  it('omits the nested detail block when the logged activity carries none', () => {
    const wrapper = mountTatva(ActivityAuditEntry, {
      props: {
        activity: {
          owner_name: 'Asha Rao',
          activity_type: 'activity_logged',
          subject: 'Quick note',
          creation: '2026-06-01 10:00:00',
        },
      },
    })
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
