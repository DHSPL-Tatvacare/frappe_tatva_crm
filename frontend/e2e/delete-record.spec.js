// A record's Delete hands the work to a job and hands the tab back. This drives the real flow: the
// modal closes at once, the record says a delete is running on it, its actions go inert, and the job's
// own answer arrives as a toast. Preconditions and cleanup go through the API (fixtures.js).
import { test, expect } from './fixtures.js'

// A real desktop: at 1280 the collapsed sidebar overlaps the record's action row and intercepts the click.
test.use({ viewport: { width: 1440, height: 900 } })

const lead = (api, suffix) =>
  api.call('frappe.client.insert', {
    doc: {
      doctype: 'CRM Lead',
      first_name: `E2E Delete ${suffix}`,
      mobile_no: `+9198765${suffix}`,
      status: 'New',
    },
  })

test('a record delete is queued, says so, and answers with a toast', async ({ page, api }) => {
  const suffix = String(Date.now()).slice(-5)
  const doc = await lead(api, suffix)
  // A linked task is the whole point: it is the cascade that used to hold the rep's request open.
  await api.call('frappe.client.insert', {
    doc: {
      doctype: 'CRM Task',
      title: `E2E linked task ${suffix}`,
      status: 'Todo',
      priority: 'Low',
      reference_doctype: 'CRM Lead',
      reference_docname: doc.name,
    },
  })

  try {
    // A leftover panel from a previous session's localStorage covers the side panel and eats the click.
    await page.addInitScript(() => window.localStorage.clear())
    await page.goto(`/crm/leads/${doc.name}`)
    // The record's action row draws icon buttons with no accessible name; the trash is its last one.
    const trash = page.locator('div.flex.gap-1\\.5 > button').last()
    await trash.waitFor({ state: 'visible', timeout: 20000 })
    // Dispatched, not pointed: an unrelated blank panel in this session overlays the rail and eats the
    // pointer. The handler under test is the same one the pointer would reach.
    await trash.evaluate((el) => el.click())
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()

    // The tab is free immediately: the modal is gone and the acknowledgement is already on screen.
    await expect(dialog).toBeHidden({ timeout: 5000 })
    await expect(page.getByText(`Deleting ${doc.name}`).first()).toBeVisible({ timeout: 5000 })

    // The job's own answer, from the worker — and the lead is gone with it.
    await expect(page.getByText(`Deleted ${doc.name}`).first()).toBeVisible({ timeout: 60000 })
    await expect(page).toHaveURL(/\/crm\/leads(\/view)?/, { timeout: 15000 })
    const gone = await api.call('frappe.client.get_count', {
      doctype: 'CRM Lead',
      filters: { name: doc.name },
    })
    expect(gone).toBe(0)
  } finally {
    await api
      .call('frappe.client.delete', { doctype: 'CRM Lead', name: doc.name })
      .catch(() => {}) // already deleted by the flow under test — that is the pass condition
  }
})

test('while the delete runs, the record says so and nothing on it can be acted on', async ({
  page,
  api,
}) => {
  const suffix = String(Date.now()).slice(-5)
  const doc = await lead(api, suffix)

  try {
    // Queue FIRST, then open the page: the chip must come from the job rows the page asks for, not from
    // a socket event this environment may never deliver (a blocked socket is exactly the case it covers).
    await api.call('tatva_connect.bulk_actions.run_or_queue', {
      action: 'Bulk Delete',
      doctype: 'CRM Lead',
      docnames: JSON.stringify([doc.name]),
      params: JSON.stringify({ delete_linked: true }),
    })
    await page.goto(`/crm/leads/${doc.name}`)
    await expect(page.getByText('Deletion in progress')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.pointer-events-none.opacity-50').first()).toBeVisible()
  } finally {
    await api
      .call('frappe.client.delete', { doctype: 'CRM Lead', name: doc.name })
      .catch(() => {})
  }
})
