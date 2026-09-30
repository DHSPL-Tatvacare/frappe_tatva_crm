// TATVA: how pickers on one screen treat long values. A screen opts in once; every picker under it follows, and a screen that never opts in keeps stock behaviour.
import { inject, provide } from 'vue'

const KEY = Symbol('tatva:pickerLayout')

// Literal classes so Tailwind's scanner sees them: never narrower than the field, at most 480px unless the field is wider; long labels end in dots and hover shows them whole.
const WIDE = Object.freeze({ listClass: 'min-w-full max-w-[480px]' })

export function provideWidePickers() {
  provide(KEY, WIDE)
}

export function usePickerLayout() {
  return inject(KEY, null)
}
