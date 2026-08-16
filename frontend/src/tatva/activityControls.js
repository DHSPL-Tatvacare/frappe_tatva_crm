import { FormControl, DateTimePicker, DatePicker } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import AttachControl from '@/components/Controls/AttachControl.vue'
import MultiValueInput from '@/tatva/MultiValueInput.vue'
import { pairTitles } from '@/tatva/linkTitle'

// Locked empty controls read "—": several frappe-ui controls ignore an empty placeholder and restore their own default.
export const NOTHING = '—'
export const hint = (text, locked) => (locked ? NOTHING : text)

const TEXTAREA = {
  is: FormControl,
  vModel: true,
  bind: () => ({ type: 'textarea' }),
}
const DATA = { is: FormControl, vModel: true, bind: () => ({ type: 'text' }) }
// No task exists yet to own the file, so it stages unattached and `save_activity` bonds it — naming the lead here wrote it to the lead the instant it was picked, before submit.
const ATTACH = {
  is: AttachControl,
  bind: (f) => ({
    folder: 'Home/Email Drafts',
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
  // TATVA: `link_query` is the server's own answer to how this Link's options must be scoped; undefined is the framework's default search.
  Link: {
    is: Link,
    bind: (f) => ({
      doctype: f.options || 'User',
      query: f.link_query?.query,
      filters: f.link_query?.filters,
    }),
    hint: (f, ctx) => ctx.__('Select {0}', [f.label]),
  },
  User: {
    is: Link,
    bind: (f) => ({
      doctype: 'User',
      query: f.link_query?.query,
      filters: f.link_query?.filters,
    }),
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

// A field that takes MORE THAN ONE value: the SAME scoped picker, many times over. Its `fieldtype` is the
// Link ONE selection is stored as, so dispatching on that alone drew a single picker over a set — the rep
// could pick one value and it reached the server as a bare string.
const MULTI_VALUE = {
  is: MultiValueInput,
  vModel: true,
  // `display` pairs with the LEAD's own selections, which is the only pairing the server vouches for.
  bind: (f, ctx) => ({
    doctype: f.options || 'CRM Picklist Value',
    query: f.link_query?.query,
    filters: f.link_query?.filters,
    titles: pairTitles(ctx.leadValues?.[f.fieldname], f.display),
  }),
}

// Asked before fieldtype, the same order the Data tab resolves it in: what differs is how many values the field holds, not what one of them is.
export const control = (f) =>
  f.multi_value ? MULTI_VALUE : CONTROLS[f.fieldtype] || DATA

// `subtle` is the ONE variant every control states, live or muted — frappe-ui's `disabled` block reads the variant back, so a silent call site mutes to a different grey than the neighbour that named one.
export function controlBind(f, ctx, locked) {
  const c = control(f)
  return {
    ...c.bind(f, ctx),
    variant: 'subtle',
    disabled: Boolean(f.read_only) || locked,
    ...(c.hint ? { placeholder: hint(c.hint(f, ctx), locked) } : {}),
  }
}
