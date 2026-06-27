<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" routeName="Notes" />
    </template>
    <template #right-header>
      <CustomActions
        v-if="notesListView?.customListActions"
        :actions="notesListView.customListActions"
      />
      <Button
        variant="solid"
        :label="__('Create')"
        iconLeft="plus"
        @click="createNote"
      />
    </template>
  </LayoutHeader>
  <ViewControls
    ref="viewControls"
    v-model="notes"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    doctype="FCRM Note"
    :options="{ allowedViews: ['list'] }"
  />
  <NotesListView
    v-if="notes.data && rows.length"
    ref="notesListView"
    v-model="notes.data.page_length_count"
    v-model:list="notes"
    :rows="rows"
    :columns="columns"
    :options="{
      showTooltip: true,
      resizeColumn: true,
      rowCount: notes.data.row_count,
      totalCount: notes.data.total_count,
    }"
    @loadMore="() => loadMore++"
    @columnWidthUpdated="() => triggerResize++"
    @updatePageCount="(count) => (updatedPageCount = count)"
    @showNote="(name) => editNote(name)"
    @applyFilter="(data) => viewControls.applyFilter(data)"
    @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
    @likeDoc="(data) => viewControls.likeDoc(data)"
    @selectionsChanged="(selections) => viewControls.updateSelections(selections)"
  />
  <EmptyState v-else-if="notes.data && !rows.length" name="Notes" :icon="NoteIcon" />

  <!-- TATVA: the unified note modal (title + content + native attachments) for the main Notes page. -->
  <TatvaNoteModal
    v-if="noteModalOpen"
    v-model="noteModalOpen"
    :note="noteModalNote"
    @saved="onNoteSaved"
  />
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import CustomActions from '@/components/CustomActions.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import ViewControls from '@/components/ViewControls.vue'
import NotesListView from '@/components/ListViews/NotesListView.vue'
import TatvaNoteModal from '@/tatva/NoteModal.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import { usersStore } from '@/stores/users'
import { formatDate, timeAgo } from '@/utils'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { ref, computed, watch } from 'vue'

const { getUser } = usersStore()
const { updateOnboardingStep } = useOnboarding('frappecrm')
const { capture } = useTelemetry()

const notes = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)
const notesListView = ref(null)

const rows = computed(() => {
  if (!notes.value?.data?.data) return []
  openNoteFromURL()
  return parseRows(notes.value.data.data, notes.value.data.columns)
})

// FCRM Note ships no list columns (its default_list_data is empty — it was a card grid), so when the
// backend returns none, fall back to a sensible default set. Once the user saves a column layout
// (CRM View Settings), get_data returns those and this fallback no longer applies.
const DEFAULT_NOTE_COLUMNS = [
  { label: __('Title'), type: 'Data', key: 'title', width: '18rem' },
  { label: __('Content'), type: 'Text Editor', key: 'content', width: '26rem' },
  { label: __('Created By'), type: 'Link', key: 'owner', width: '10rem', options: 'User' },
  { label: __('Last Modified'), type: 'Datetime', key: 'modified', width: '9rem' },
]

const columns = computed(() => {
  let _columns = notes.value?.data?.columns || []
  if (!_columns.length) _columns = DEFAULT_NOTE_COLUMNS
  return _columns.map((col, index) =>
    index === _columns.length - 1 ? { ...col, align: 'right' } : col,
  )
})

function parseRows(list, columns = []) {
  return list.map((note) => {
    let _rows = {}
    notes.value?.data.rows.forEach((row) => {
      _rows[row] = note[row]

      let fieldType = columns?.find((col) => col.key == row)?.type
      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(note[row], '', true, fieldType == 'Datetime')
      }

      if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(note[row]),
          timeAgo: __(timeAgo(note[row])),
        }
      } else if (row === 'owner') {
        _rows[row] = {
          label: note.owner && getUser(note.owner).full_name,
          ...(note.owner && getUser(note.owner)),
        }
      }
    })
    return _rows
  })
}

// --- create / edit via the unified NoteModal (attachments included) ---
const noteModalOpen = ref(false)
const noteModalNote = ref(null)

function createNote() {
  noteModalNote.value = null
  noteModalOpen.value = true
}

function editNote(noteName) {
  const found = notes.value?.data?.data?.find((n) => n.name === noteName)
  noteModalNote.value = found || { name: noteName }
  noteModalOpen.value = true
}

function onNoteSaved({ isInsert } = {}) {
  notes.value.reload()
  if (isInsert) {
    updateOnboardingStep('create_first_note')
    capture('note_created')
  } else {
    capture('note_updated')
  }
}

watch(
  () => notes.value?.data?.page_length_count,
  (val, old_value) => {
    openNoteFromURL()
    if (!val || val === old_value) return
    updatedPageCount.value = val
  },
)

const openNoteFromURL = () => {
  const searchParams = new URLSearchParams(window.location.search)
  const noteName = searchParams.get('open')

  if (noteName && notes.value?.data?.data) {
    const foundNote = notes.value.data.data.find(
      (note) => note.name === noteName,
    )
    if (foundNote) editNote(foundNote.name)
    searchParams.delete('open')
    window.history.replaceState(null, '', window.location.pathname)
  }
}
</script>
