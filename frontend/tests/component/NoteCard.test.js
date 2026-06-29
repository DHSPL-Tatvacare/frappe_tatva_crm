// Purpose: a Note must render in the shared activity-card shape — author name, title, the (read-only)
// content, and the attachment count badge — so Notes stay visually consistent with Calls/Comments and
// no field silently stops showing. Author name comes via usersStore (mocked to a pure lookup).
import { describe, it, expect, vi } from 'vitest'
import { mountTatva } from './_mount.js'

vi.mock('@/stores/users', () => ({
  usersStore: () => ({ getUser: (id) => ({ full_name: id === 'asha@x.com' ? 'Asha Rao' : id }) }),
}))

import NoteCard from '@/tatva/NoteCard.vue'

const baseNote = {
  name: 'NOTE-001',
  owner: 'asha@x.com',
  modified: '2026-06-01 10:00:00',
  title: 'Follow up Monday',
  content: '<p>Call the patient</p>',
  attachments: 2,
}

describe('NoteCard', () => {
  it('renders author, title, content and attachment count', () => {
    const wrapper = mountTatva(NoteCard, { props: { note: baseNote } })
    expect(wrapper.text()).toContain('Asha Rao')
    expect(wrapper.text()).toContain('Follow up Monday')
    expect(wrapper.find('[data-stub="TextEditor"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('2') // attachment badge
  })

  it('omits the title and attachment chrome when the note has neither', () => {
    const wrapper = mountTatva(NoteCard, {
      props: { note: { name: 'N2', owner: 'asha@x.com', modified: '2026-06-01 10:00:00', content: '<p>x</p>' } },
    })
    expect(wrapper.text()).not.toContain('Follow up Monday')
    expect(wrapper.text()).not.toContain('paperclip')
  })
})
