import { FormControl, DateTimePicker, DatePicker } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import AttachControl from '@/components/Controls/AttachControl.vue'

// Locked empty controls read "—": several frappe-ui controls ignore an empty placeholder and restore their own default.
export const NOTHING = '—'
export const hint = (text, locked) => (locked ? NOTHING : text)

const TEXTAREA = {
  is: FormControl,
  vModel: true,
  bind: () => ({ type: 'textarea' }),
}
const DATA = { is: FormControl, vModel: true, bind: () => ({ type: 'text' }) }
const ATTACH = {
  is: AttachControl,
  bind: (f, ctx) => ({
    doctype: 'CRM Lead',
    docname: ctx.leadName,
    imageOnly: f.fieldtype === 'Attach Image',
  }),
}

// One row per fieldtype: which component, which props, and whether it carries its value with v-model or :value + @change.
const CONTROLS = {
  Select: {
    is: FormControl,
    vModel: true,
    bind: (f, ctx) => ({ type: 'select', options: ctx.optionList(f) }),
    hint: (f, ctx) => ctx.__('Select option'),
  },
  Datetime: {
    is: DateTimePicker,
    bind: (f, ctx) => ({ format: ctx.datetimeFormat }),
    hint: (f, ctx) => ctx.__('Select date & time'),
  },
  Date: {
    is: DatePicker,
    bind: (f, ctx) => ({ format: ctx.dateFormat }),
    hint: (f, ctx) => ctx.__('Select date'),
  },
  Link: {
    is: Link,
    bind: (f) => ({ doctype: f.options || 'User' }),
    hint: (f, ctx) => ctx.__('Select {0}', [f.label]),
  },
  User: {
    is: Link,
    bind: () => ({ doctype: 'User' }),
    hint: (f, ctx) => ctx.__('Select {0}', [f.label]),
  },
  Check: {
    is: FormControl,
    vModel: true,
    bind: () => ({ type: 'checkbox' }),
    wrap: 'flex h-8 items-center',
  },
  'Small Text': TEXTAREA,
  Text: TEXTAREA,
  'Long Text': TEXTAREA,
  Attach: ATTACH,
  'Attach Image': ATTACH,
}

export const control = (f) => CONTROLS[f.fieldtype] || DATA

export function controlBind(f, ctx, locked) {
  const c = control(f)
  return {
    ...c.bind(f, ctx),
    disabled: Boolean(f.read_only) || locked,
    ...(c.hint ? { placeholder: hint(c.hint(f, ctx), locked) } : {}),
  }
}
