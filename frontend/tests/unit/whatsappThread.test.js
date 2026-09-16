import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive } from 'vue'

const call = vi.fn()
vi.mock('frappe-ui', () => ({ call: (...args) => call(...args) }))

const { useWhatsappThread } = await import('@/tatva/whatsappThread.js')

const row = (n) => ({ name: `m${String(n).padStart(3, '0')}`, creation: `2026-09-01 10:00:${String(n).padStart(2, '0')}` })
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => row(from + i))

function resource(data) {
  return reactive({ url: 'crm.api.whatsapp.get_whatsapp_messages', params: { reference_name: 'L1', paged: 1 }, data })
}

describe('useWhatsappThread', () => {
  beforeEach(() => call.mockReset())

  it('asks for the page before the oldest message it holds, through the resource it was given', async () => {
    const thread = useWhatsappThread(resource(range(51, 55)))
    call.mockResolvedValue(range(46, 50))
    await thread.loadOlder()
    expect(call).toHaveBeenCalledWith('crm.api.whatsapp.get_whatsapp_messages', { reference_name: 'L1', paged: 1, before: 'm051' })
    expect(thread.messages.value.map((m) => m.name)).toEqual(range(46, 55).map((m) => m.name))
  })

  it('stops asking once a page comes back empty', async () => {
    const thread = useWhatsappThread(resource(range(1, 3)))
    call.mockResolvedValue([])
    await thread.loadOlder()
    expect(thread.exhausted.value).toBe(true)
    expect(thread.loadOlder()).toBeNull()
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('keeps what a reload pushed out of the newest page, without repeats', async () => {
    const newest = resource(range(11, 15))
    const thread = useWhatsappThread(newest)
    newest.data = range(13, 17)
    await nextTick()
    expect(thread.messages.value.map((m) => m.name)).toEqual(range(11, 17).map((m) => m.name))
    expect(thread.newest.value).toBe('m017')
  })

  it('drops held history when a reload no longer meets it, rather than hide a gap', async () => {
    const newest = resource(range(11, 15))
    const thread = useWhatsappThread(newest)
    newest.data = range(40, 44)
    await nextTick()
    expect(thread.messages.value.map((m) => m.name)).toEqual(range(40, 44).map((m) => m.name))
  })
})
