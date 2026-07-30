import { createResource } from 'frappe-ui'

export const filterableFields = createResource({
  url: 'crm.api.doc.get_filterable_fields',
  transform: (data) => {
    data = data
      .filter((field) => !field.fieldname.startsWith('_'))
      // TATVA: a DERIVED field is computed per request from other columns; it is not an attribute of the
      // document. This builder feeds Assignment Rules and SLA conditions, which are evaluated against a
      // saved doc server-side, so a condition on one could never match. The list Filter control keeps its
      // own resource and is unaffected — it is the surface that CAN resolve a derived field.
      .filter((field) => !field.is_derived)
      .map((field) => {
        return {
          label: field.label,
          value: field.fieldname,
          ...field,
        }
      })
    return data
  },
})
