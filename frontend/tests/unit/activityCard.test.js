// `actorFor` is the ONE attribution resolver every card and rail row reads. A task raised by a journey that
// never parked carries no workflow token — only the row's own `custom_automated` stamp — so the boolean arm
// is what keeps that row from being attributed to nobody at all.
import { describe, it, expect } from 'vitest'
import { actorFor } from '@/tatva/activityCard.js'

const human = { label: 'Goodflip Inside Sales Partner API', image: '' }

describe('actorFor', () => {
  it('names the workflow when the row carries one', () => {
    expect(actorFor({ label: 'IS Lead Capture', run: 'j1' }, human).label).toBe('Workflow: IS Lead Capture')
  })

  it('says Automation when the engine acted but named no workflow', () => {
    expect(actorFor(true, human).label).toBe('Automation')
  })

  it('leaves a row nobody automated with its human', () => {
    expect(actorFor(false, human)).toBe(human)
    expect(actorFor(undefined, human)).toBe(human)
  })
})
