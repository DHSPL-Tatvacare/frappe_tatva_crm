import { getScript } from '@/data/script'
import { globalStore } from '@/stores/global'
import { getMeta } from '@/stores/meta'
import { useAttachments } from '@/composables/useAttachments'
import { showSettings, activeSettingsPage } from '@/composables/settings'
import { runSequentially, parseAssignees, sanitizeText } from '@/utils'
import { findMissingMandatory } from '@/utils/fieldTransforms'
import { createDocumentResource, createResource, toast } from 'frappe-ui'
import { ref, reactive, getCurrentInstance } from 'vue'

const documentsCache = {}
const controllersCache = {}
const assigneesCache = {}
const permissionsCache = {}
const linkTitlesCache = {}

export function useDocument(doctype, docname, resourceOverrides = {}) {
  if (typeof docname === 'number') docname = String(docname)
  const { setupScript, scripts } = getScript(doctype)
  const meta = getMeta(doctype)
  const { trackOldFile, processPendingDeletions } = useAttachments(
    doctype,
    docname,
  )

  const vm = getCurrentInstance()?.proxy
  documentsCache[doctype] = documentsCache[doctype] || {}

  const error = ref('')

  // TATVA: every field edit on a document saves the WHOLE document, so two edits moments apart used to
  // fly at the database together, land on the same row and the second was refused (MariaDB 1020 under
  // `innodb_snapshot_isolation`) — the field snapped back and the rep lost the change. Sending only what
  // changed is not an option: `triggerOnChange` runs form scripts that set OTHER fields, so a partial
  // payload would silently drop whatever they filled in. Payload, scripts and handlers are therefore
  // untouched; only the TIMING changes, here, in the one resource every surface already saves through.
  const DEADLOCK = 'QueryDeadlockError'
  // True while an attempt that a deadlock would still buy a retry for is in flight — so the resource's own
  // error toast stays quiet for a failure the rep is never going to see the consequences of.
  let retryPending = false

  if (!documentsCache[doctype][docname || '']) {
    if (docname) {
      documentsCache[doctype][docname] = createDocumentResource(
        {
          realtime: Boolean(vm?.$socket),
          doctype: doctype,
          name: docname,
          onSuccess: async () => await setupFormScript(),
          onError: (err) => {
            error.value = err
            if (err.exc_type === 'DoesNotExistError') {
              toast.error(__(err.messages[0] || 'Document does not exist'))
            }
            if (err.exc_type === 'PermissionError') {
              toast.error(
                __(
                  err.messages[0] ||
                    'You do not have permission to access this document',
                ),
              )
            }
          },
          setValue: {
            onSuccess: () => {
              triggerOnSave()
              toast.success(__('Document updated successfully'))
              processPendingDeletions()
            },
            onError: (err) => {
              // Silent for the attempt a retry is already queued for: it succeeds moments later, and a
              // toast for it would name a failure that never reached the rep's record.
              if (err?.exc_type === DEADLOCK && retryPending) return
              triggerOnError(err)

              if (err.exc_type == 'MandatoryError') {
                const fieldName = err.messages
                  .map((msg) => {
                    let arr = msg.split(': ')
                    return arr[arr.length - 1].trim()
                  })
                  .join(', ')
                toast.error(__('Mandatory field error: {0}', [fieldName]))
                return
              }

              err.messages?.forEach((msg) => {
                toast.error(msg)
              })

              if (err.messages?.length === 0) {
                toast.error(__('An error occurred while updating the document'))
              }

              console.error(err)
            },
          },
          ...resourceOverrides,
        },
        vm,
      )
      if (!documentsCache[doctype][docname].fieldHtmlMap) {
        documentsCache[doctype][docname].fieldHtmlMap = {}
      }
      if (!documentsCache[doctype][docname].fieldPropertyOverrides) {
        documentsCache[doctype][docname].fieldPropertyOverrides = {}
      }

      // Override the submit function to trigger validation before submitting
      // TODO: fix validate function to return error message instead of throwing error in frappe-ui and remove try-catch block here
      const _save = documentsCache[doctype][docname].save
      const _setValue = documentsCache[doctype][docname].setValue

      // One write at a time for THIS document: `set_value` is get_doc→save too, so both writers race.
      let inFlight = Promise.resolve()

      // A write the server refused with a deadlock is sent ONCE more. The database's own instruction is to
      // restart the transaction and a fresh request is one, so this is the only retry that can work — and
      // it is what covers a collision with a background job writing the same record.
      function submitOnce(resource, originalSubmit, args, isRetry = false) {
        const [params, options = {}] = args
        retryPending = !isRetry
        return new Promise((resolve) => {
          originalSubmit.call(resource, params, {
            ...options,
            onSuccess: (...a) => {
              retryPending = false
              options.onSuccess?.(...a)
              resolve()
            },
            onError: (err) => {
              if (!isRetry && err?.exc_type === DEADLOCK) {
                resolve(submitOnce(resource, originalSubmit, args, true))
                return
              }
              retryPending = false
              options.onError?.(err)
              resolve()
            },
          })
        })
      }

      // The one queue both writers join, so their order is the order the rep made them.
      function enqueue(resource, originalSubmit, args) {
        const run = () => submitOnce(resource, originalSubmit, args)
        inFlight = inFlight.then(run, run)
        return inFlight
      }

      const _originalSave = _save.submit
      _save.submit = async function (...args) {
        try {
          await triggerOnValidate()
        } catch (err) {
          console.error(err)
          return
        }
        const mandatory = checkMandatory(documentsCache[doctype][docname].doc)
        if (mandatory) return
        return enqueue(_save, _originalSave, args)
      }

      // A field write joins the SAME queue, and carries no whole-document copy to go stale.
      const _originalSetValue = _setValue.submit
      _setValue.submit = function (...args) {
        return enqueue(_setValue, _originalSetValue, args)
      }
    } else {
      documentsCache[doctype][''] = reactive({
        doc: { __newDocument: true, doctype },
        fieldPropertyOverrides: {},
      })
      setupFormScript()
    }
  }

  assigneesCache[doctype] = assigneesCache[doctype] || {}

  if (!assigneesCache[doctype][docname || '']) {
    assigneesCache[doctype][docname || ''] = createResource({
      url: 'crm.api.doc.get_assigned_users',
      cache: `assignees:${doctype}:${docname}`,
      auto: docname ? true : false,
      params: {
        doctype: doctype,
        name: docname,
      },
      transform: (data) => parseAssignees(data),
    })
  }

  permissionsCache[doctype] = permissionsCache[doctype] || {}

  if (!permissionsCache[doctype][docname || '']) {
    permissionsCache[doctype][docname || ''] = createResource({
      url: 'frappe.client.get_doc_permissions',
      cache: `permissions:${doctype}:${docname}`,
      auto: docname ? true : false,
      params: {
        doctype: doctype,
        docname: docname,
      },
      initialData: { permissions: {} },
    })
  }

  // TATVA: one map per doc — {DocType::pk -> clean title} for the doc's composite-`::`-PK Link
  // fields, so the detail side panel shows the doctype's title_field (e.g. Stage.display_label)
  // instead of the raw PK. Same brain as the list `_link_titles`; one call per doc (mirrors
  // assignees/permissions above), never per field. Missing key => Field.vue shows the raw value.
  linkTitlesCache[doctype] = linkTitlesCache[doctype] || {}

  if (!linkTitlesCache[doctype][docname || '']) {
    linkTitlesCache[doctype][docname || ''] = createResource({
      url: 'tatva_connect.api.list_link_titles.get_doc_link_titles',
      cache: `linkTitles:${doctype}:${docname}`,
      auto: docname ? true : false,
      params: {
        doctype: doctype,
        name: docname,
      },
      initialData: {},
    })
  }

  async function setupFormScript() {
    if (
      controllersCache[doctype] &&
      typeof controllersCache[doctype][docname || ''] === 'object'
    ) {
      return
    }

    if (!controllersCache[doctype]) {
      controllersCache[doctype] = {}
    }

    controllersCache[doctype][docname || ''] = {}

    const { makeCall } = globalStore()

    let helpers = {}

    helpers.crm = {
      makePhoneCall: makeCall,
      openSettings: (page) => {
        showSettings.value = true
        activeSettingsPage.value = page
      },
    }

    const controllersArray = await setupScript(
      documentsCache[doctype][docname || ''],
      helpers,
    )

    if (!controllersArray || controllersArray.length === 0) return

    const organizedControllers = {}
    for (const controller of controllersArray) {
      const controllerKey = controller._className || controller.constructor.name
      if (!organizedControllers[controllerKey]) {
        organizedControllers[controllerKey] = []
      }
      organizedControllers[controllerKey].push(controller)
    }
    controllersCache[doctype][docname || ''] = organizedControllers

    triggerOnLoad()
    triggerOnRender()
  }

  function getControllers(row = null) {
    const _doctype = row?.doctype || doctype
    const controllerKey = _doctype.replace(/\s+/g, '')

    const docControllers = controllersCache[doctype]?.[docname || '']

    if (
      typeof docControllers === 'object' &&
      docControllers !== null &&
      !Array.isArray(docControllers)
    ) {
      return docControllers[controllerKey] || []
    }
    return []
  }

  function checkMandatory(doc) {
    let fields = meta?.doctypesMeta?.[doctype]?.fields || []

    if (!fields || fields.length === 0) return

    const overrides =
      documentsCache[doctype][docname || '']?.fieldPropertyOverrides || {}

    const missingFields = findMissingMandatory(fields, doc, {
      propertyOverrides: overrides,
      doctypesMeta: meta?.doctypesMeta || {},
    })

    if (missingFields.length > 0) {
      toast.error(
        __('Mandatory fields required: {0}', [missingFields.join(', ')]),
      )
      return __('Mandatory fields required: {0}', [missingFields.join(', ')])
    }
  }

  async function triggerOnLoad() {
    const handler = async function () {
      await (this.onLoad?.() || this.on_load?.() || this.onload?.())
    }
    await trigger(handler)
  }

  async function triggerOnRender() {
    const handler = async function () {
      await (this.onRender?.() || this.on_render?.() || this.refresh?.())
    }
    await trigger(handler)
  }

  async function triggerOnBeforeCreate() {
    const args = Array.from(arguments)
    const handler = async function () {
      await (this.onBeforeCreate?.(...args) || this.on_before_create?.(...args))
    }
    await trigger(handler)
  }

  async function triggerOnValidate() {
    const handler = async function () {
      await (this.onValidate?.() || this.on_validate?.() || this.validate?.())
    }
    await trigger(handler)
  }

  async function triggerOnSave() {
    const handler = async function () {
      await (this.onSave?.() || this.on_save?.())
    }
    await trigger(handler)
  }

  async function triggerOnError() {
    const handler = async function () {
      await (this.onError?.() || this.on_error?.())
    }
    await trigger(handler)
  }

  async function triggerOnChange(fieldname, _value, row) {
    const value = sanitizeText(_value)
    let oldValue = null
    if (row) {
      oldValue = row[fieldname]
      row[fieldname] = value
    } else {
      oldValue = documentsCache[doctype][docname || ''].doc[fieldname]
      documentsCache[doctype][docname || ''].doc[fieldname] = value
      trackOldFile(oldValue, value)
    }

    const handler = async function () {
      this.value = value
      this.oldValue = oldValue
      if (row) {
        this.currentRowIdx = row.idx
      }
      await this[fieldname]?.()
    }

    try {
      await trigger(handler, row)
    } catch (error) {
      console.error(handler)
      throw error
    }
  }

  async function triggerButton(fieldname, row) {
    const handler = async function () {
      if (row) {
        this.currentRowIdx = row.idx
      }
      await this[fieldname]?.()
    }
    await trigger(handler, row)
  }

  async function triggerOnRowAdd(row) {
    const handler = async function () {
      this.currentRowIdx = row.idx
      this.value = row
      await this[row.parentfield + '_add']?.()
    }

    await trigger(handler, row)
  }

  async function triggerOnRowRemove(selectedRows, rows) {
    const handler = async function () {
      if (selectedRows.size === 1) {
        const selectedRow = Array.from(selectedRows)[0]
        this.currentRowIdx = rows.find((r) => r.name === selectedRow).idx
      } else {
        delete this.currentRowIdx
      }

      this.selectedRows = Array.from(selectedRows)
      this.rows = rows

      await this[rows[0].parentfield + '_remove']?.()
    }

    await trigger(handler, rows[0])
  }

  async function triggerOnCreateLead() {
    const args = Array.from(arguments)
    const handler = async function () {
      await (this.onCreateLead?.(...args) || this.on_create_lead?.(...args))
    }
    await trigger(handler)
  }

  async function triggerConvertToDeal() {
    const args = Array.from(arguments)
    const handler = async function () {
      await (this.convertToDeal?.(...args) || this.convert_to_deal?.(...args))
    }
    await trigger(handler)
  }

  function setFieldHtml(fieldname, html) {
    const cache = documentsCache[doctype][docname || '']
    if (!cache.fieldHtmlMap) cache.fieldHtmlMap = {}
    cache.fieldHtmlMap[fieldname] = html
  }

  async function trigger(taskFn, row = null) {
    const controllers = getControllers(row)
    if (!controllers.length) return

    const tasks = controllers.map(
      (controller) => async () => await taskFn.call(controller),
    )

    await runSequentially(tasks)
  }

  return {
    document: documentsCache[doctype][docname || ''],
    assignees: assigneesCache[doctype][docname || ''],
    permissions: permissionsCache[doctype][docname || ''],
    linkTitles: linkTitlesCache[doctype][docname || ''],
    scripts,
    error,
    getControllers,
    triggerOnLoad,
    triggerOnRender,
    triggerOnBeforeCreate,
    triggerOnValidate,
    triggerOnSave,
    triggerOnError,
    triggerOnChange,
    triggerButton,
    triggerOnRowAdd,
    triggerOnRowRemove,
    setupFormScript,
    triggerOnCreateLead,
    triggerConvertToDeal,
    setFieldHtml,
  }
}
