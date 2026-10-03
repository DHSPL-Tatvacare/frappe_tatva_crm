// TATVA: the rows and columns of a native `ViewControls` list (`crm.api.doc.get_data`), shaped for a ListView — one reading the run history, a workflow's versions and a form's versions share.
import { formatListDate } from '@/utils'

// A run, a workflow version and a form version carry no currency, float or percent field, so the only typed cells are dates.
export function listRows(list) {
  if (!list?.data?.data) return []
  return list.data.data.map((doc) => {
    let _rows = {}
    list.data.rows.forEach((row) => {
      _rows[row] = doc[row]

      let fieldType = list.data.columns?.find(
        (col) => (col.key || col.value) == row,
      )?.type

      if (fieldType && ['Date', 'Datetime'].includes(fieldType)) {
        _rows[row] = formatListDate(doc[row], fieldType == 'Datetime')
      }
    })
    return _rows
  })
}

export function listColumns(list) {
  let _columns = list?.data?.columns || []

  if (_columns.length) {
    _columns = _columns.map((col, index) => {
      if (index === _columns.length - 1) {
        return { ...col, align: 'right' }
      }
      return col
    })
  }

  return _columns
}
