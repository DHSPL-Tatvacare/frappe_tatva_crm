// Page object for the Smart Views surface (/crm/smart-views). Locators are role/label/text based
// (resilient to styling), grounded in src/pages/SmartViews.vue + src/tatva/SmartView*.vue.
import { expect } from '@playwright/test'

export class SmartViewsPage {
  constructor(page) {
    this.page = page
  }

  async goto(view = '') {
    await this.page.goto(`/crm/smart-views${view ? '/' + view : ''}`)
    await expect(this.page.locator('#app')).toBeVisible()
  }

  // The editor's name field (placeholder grounded in SmartViewEditor.vue) — also our "editor is open" signal.
  get nameField() {
    return this.page.getByPlaceholder('My Open Leads')
  }

  // Open the create drawer from whichever entry point is showing: the empty-state "Create Smart View"
  // button, else the populated strip's "Add view" (+) control.
  async openCreate() {
    const empty = this.page.getByRole('button', { name: 'Create Smart View' })
    if (await empty.isVisible().catch(() => false)) await empty.click()
    else await this.page.getByRole('button', { name: 'Add view' }).click()
    await expect(this.nameField).toBeVisible()
  }

  // Walk the 3-step editor leaving predicate/columns at their defaults (a valid "all rows" view) and
  // submit. Assumes E2E_USER needs no manual grain pick (single-grain → auto-applied, or System Manager).
  async createView(label) {
    await this.openCreate()
    await this.nameField.fill(label)
    await this.page.getByRole('button', { name: 'Next' }).click() // Details → Conditions
    await this.page.getByRole('button', { name: 'Next' }).click() // Conditions → Columns
    await this.page.getByRole('button', { name: 'Create view' }).click()
    await expect(this.nameField).toBeHidden() // drawer closed = saved
  }

  // The active view's name is the :view route param after a create/select.
  activeViewName() {
    const m = /\/smart-views\/([^/?#]+)/.exec(this.page.url())
    return m ? decodeURIComponent(m[1]) : ''
  }

  tab(label) {
    return this.page.getByRole('button', { name: label }).first()
  }

  // Mobile: the collapsed trigger shows the active view's label; clicking it opens the bottom sheet.
  async openMobileSheet(triggerLabel) {
    const trigger = triggerLabel
      ? this.page.getByRole('button', { name: triggerLabel }).first()
      : this.page.locator('button').first()
    await trigger.click()
    const sheet = this.page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    return sheet
  }
}
