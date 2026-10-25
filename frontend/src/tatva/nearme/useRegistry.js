import { computed, ref, watch } from 'vue'
import { call, toast } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { doctorStage } from '@/tatva/nearme/doctorMeta'

// The page provides one registry; its panel injects it, so the map and the list read the same state.
export const REGISTRY = Symbol('nearme-registry')

const RADII_KM = [5, 10, 15, 30, 60, 120]

// TATVA: Near Me's registry — the ring or name search around `where.origin`, its filters, and the jump to a searched place.
// `where` = { origin, originAddress, originArea, searchedArea }, the page's refs for the point being searched around.
export function useRegistry(where) {
  const doctors = ref([])
  // The reply as linkTitle.js reads a list ({ data: { _link_titles } }), so a stage shows its title through the one reader.
  const territory = ref(null)
  const loading = ref(false)
  // 'ring' (a place, with a radius) or 'search' (a name, the whole book) — set by the server, read by the panel.
  const scope = ref('ring')
  // The server said the ring held more rows than it returned (nearest-first) — the count line says so (C7).
  const capped = ref(false)

  // Null until the server answers: on first load IT picks the radius, walking outwards until it finds doctors, so the
  // page cannot open on an empty list merely because a number in the client was too small. A picked radius is honoured exactly.
  const radiusKm = ref(null)
  const radiusOptions = RADII_KM.map((km) => ({
    label: `${km} km`,
    onClick: () => {
      radiusKm.value = km
      loadDoctors({ radius: km })
    },
  }))

  async function loadDoctors({ radius = null, q = '' } = {}) {
    if (!where.origin.value) return
    loading.value = true
    try {
      // radius_km omitted => the server's ladder decides and reports back; passed => searched exactly.
      const args = { lat: where.origin.value.lat, lng: where.origin.value.lng }
      if (radius) args.radius_km = radius
      // A name is not a place — with `q` the server searches the whole anchored book and ignores the ring, so a doctor 800 km away is still found.
      if (q.trim()) args.q = q.trim()
      const r = await call(
        'tatva_connect.near_me.api.doctors_in_territory',
        args,
      )
      doctors.value = r?.doctors || []
      territory.value = { data: r }
      // The server says which question it answered; radiusKm keeps its ring value so clearing the box returns to it.
      scope.value = r?.scope || 'ring'
      if (scope.value === 'ring')
        radiusKm.value = Number(r?.radius_km) || radiusKm.value
      capped.value = !!r?.capped
    } catch (e) {
      // The access sentence is reserved for the server actually SAYING so (NM-02); anything else is "couldn't load".
      doctors.value = []
      territory.value = null
      capped.value = false
      if (e?.exc_type === 'PermissionError')
        toast.error(__('You do not have access to Near Me.'))
      else toast.error(__('The list could not be loaded. Try again.'))
    } finally {
      loading.value = false
    }
  }

  // ---- filters --------------------------------------------------------------------------------
  const filterStage = ref('')
  const filterSource = ref('')
  const filterGrain = ref('')
  const filterSpeciality = ref('')

  // The value is the key the rows filter on; the label is what the rep reads (a stage's title, never its `::` key).
  function distinct(field, labelOf = (d) => d[field]) {
    const seen = new Map()
    for (const d of doctors.value) {
      if (d[field] && !seen.has(d[field])) seen.set(d[field], labelOf(d))
    }
    const opts = [...seen].map(([value, label]) => ({ label, value }))
    opts.sort((a, b) => a.label.localeCompare(b.label))
    return [{ label: __('All'), value: '' }, ...opts]
  }
  const stageOptions = computed(() =>
    distinct('stage', (d) => doctorStage(d, territory.value)),
  )
  const sourceOptions = computed(() => distinct('source'))
  const grainOptions = computed(() => distinct('grain'))

  // Speciality is typed free text, so one speciality is one key whatever its capitals or spacing.
  function specialityKey(d) {
    return (d.speciality || '').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  // The map's chips: each speciality here, as first typed, with how many doctors have it, most first.
  const specialityChips = computed(() => {
    const chips = new Map()
    for (const d of doctors.value) {
      const key = specialityKey(d)
      if (!key) continue
      const chip = chips.get(key) || {
        value: key,
        label: d.speciality,
        count: 0,
      }
      chip.count++
      chips.set(key, chip)
    }
    return [...chips.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    )
  })

  // No name branch: the SERVER matched the name (`q`), so filtering its rows would hide a match whose name lives in a field the row does not carry.
  const filteredDoctors = computed(() =>
    doctors.value.filter(
      (d) =>
        (!filterStage.value || d.stage === filterStage.value) &&
        (!filterSource.value || d.source === filterSource.value) &&
        (!filterGrain.value || d.grain === filterGrain.value) &&
        (!filterSpeciality.value ||
          specialityKey(d) === filterSpeciality.value),
    ),
  )

  // C8: the business line is information only when the territory actually spans more than one.
  const territoryIsMixed = computed(
    () => new Set(doctors.value.map((d) => d.grain).filter(Boolean)).size > 1,
  )

  // "12 of 87" whenever a filter or search narrows the loaded set; the bare number when nothing does.
  const countLabel = computed(() =>
    filteredDoctors.value.length === doctors.value.length
      ? String(doctors.value.length)
      : __('{0} of {1}', [filteredDoctors.value.length, doctors.value.length]),
  )

  const activeFilters = computed(
    () =>
      [
        filterStage.value,
        filterSource.value,
        filterGrain.value,
        filterSpeciality.value,
      ].filter(Boolean).length,
  )

  function clearFilters() {
    filterStage.value = ''
    filterSource.value = ''
    filterGrain.value = ''
    filterSpeciality.value = ''
  }

  // ---- search and the area jump ---------------------------------------------------------------
  const search = ref('')
  const areaResults = ref([])

  // The empty list says what was searched — a name across the whole book, or the ring the server actually used.
  const emptyTitle = computed(() =>
    scope.value === 'search'
      ? __('Nothing in the registry matches “{0}”', [search.value.trim()])
      : __('Nothing in the registry within {0} km', [radiusKm.value]),
  )
  const emptyDescription = computed(() =>
    activeFilters.value
      ? __('Clear the filters to see everyone here.')
      : scope.value === 'search'
        ? __('Only entries with a clinic location are listed.')
        : __('Widen the radius to look further out.'),
  )

  // Places are offered only when no doctor matched — asked AFTER the doctor search answers, so the decision reads this query's rows.
  async function searchArea(q) {
    if (q.trim().length < 3 || doctors.value.length) {
      areaResults.value = []
      return
    }
    try {
      const r = await call('tatva_connect.location.api.geocode_search', {
        query: q.trim(),
      })
      // A newer query superseded this one while Google answered.
      if (search.value === q) areaResults.value = r || []
    } catch {
      areaResults.value = []
    }
  }

  const searchDoctors = useDebounceFn(async (q) => {
    await loadDoctors({ radius: q.trim() ? null : radiusKm.value, q })
    if (search.value === q) searchArea(q)
  }, 400)

  watch(search, searchDoctors)

  function goToArea(place) {
    where.searchedArea.value = true
    where.origin.value = { lat: place.lat, lng: place.lng }
    where.originAddress.value = place.address
    where.originArea.value = place.area || ''
    areaResults.value = []
    // Clearing the box is the reload: the search watcher re-asks for the ring around the new origin, once.
    search.value = ''
  }

  return {
    where,
    doctors,
    territory,
    loading,
    scope,
    capped,
    radiusKm,
    radiusOptions,
    loadDoctors,
    filterStage,
    filterSource,
    filterGrain,
    filterSpeciality,
    specialityChips,
    stageOptions,
    sourceOptions,
    grainOptions,
    filteredDoctors,
    territoryIsMixed,
    countLabel,
    activeFilters,
    clearFilters,
    search,
    areaResults,
    emptyTitle,
    emptyDescription,
    goToArea,
  }
}
