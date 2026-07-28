<!-- TATVA: a picker whose vocabulary only the PROVIDER knows.

     The options are fetched SERVER-side from the account a sibling field names — the credential is a
     Password column and never reaches this component. Cached per account for the life of the page, so
     re-opening the inspector or moving between nodes on the same account costs nothing, with an explicit
     Refresh for the case the author has just added an agent on the provider's dashboard.

     "No options" and "we could not ask the provider" are different answers and are shown differently: an
     empty list is a fact about the account, an error is a fact about the connection, and an author who
     cannot tell them apart goes looking in the wrong place. -->
<template>
  <div>
    <div class="mb-1 flex items-baseline gap-2">
      <label class="text-xs text-ink-gray-5">
        {{ __(label) }}
        <span v-if="reqd" class="text-ink-red-2">*</span>
      </label>
      <div class="flex-1" />
      <!-- A secondary action, sized BELOW the label so it never reads as a second field name. Hidden
           entirely while read-only: an author who cannot edit has nothing to refresh. -->
      <span v-if="loading" class="text-[11px] text-ink-gray-4">{{ __('Loading…') }}</span>
      <button
        v-else-if="source && !disabled"
        type="button"
        class="text-[11px] text-ink-gray-4 underline-offset-2 hover:text-ink-gray-6 hover:underline"
        @click="refresh"
      >
        {{ __('Refresh') }}
      </button>
    </div>

    <Autocomplete
      :modelValue="modelValue"
      :options="agentOptions"
      :placeholder="placeholder"
      :disabled="disabled || !source"
      @update:modelValue="(v) => emit('update:modelValue', v?.value ?? null)"
    />

    <p v-if="!source" class="mt-1 text-xs text-ink-gray-4">{{ __(gateText) }}</p>
    <p v-else-if="fetchError" class="mt-1 text-xs text-ink-red-3">
      {{ __('Could not reach the provider: {0}', [fetchError]) }}
    </p>
    <p v-else-if="loaded && !agents.length" class="mt-1 text-xs text-ink-gray-4">
      {{ __(emptyText) }}
    </p>

    <!-- The prompt the chosen agent will actually speak from. Picking an agent by id alone is picking
         blind; this is the one place an author can read what it says before a patient hears it. -->
    <div v-if="modelValue && (agent.prompt || agent.welcome_message)" class="mt-2">
      <button
        type="button"
        class="flex items-center gap-1 text-xs text-ink-gray-6 hover:text-ink-gray-8"
        @click="showPrompt = !showPrompt"
      >
        <span class="text-[9px] leading-none">{{ showPrompt ? '▼' : '▶' }}</span>
        {{ showPrompt ? __('Hide {0}', [__(detailLabel)]) : __('Read {0}', [__(detailLabel)]) }}
      </button>
      <div v-if="showPrompt" class="mt-1.5 rounded border border-outline-gray-2 bg-surface-gray-1 p-2">
        <div v-if="agent.welcome_message">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-gray-5">
            {{ __('Opening line') }}
          </p>
          <p class="mt-0.5 whitespace-pre-wrap text-xs leading-snug text-ink-gray-7">
            {{ agent.welcome_message }}
          </p>
        </div>
        <div v-if="agent.prompt" :class="agent.welcome_message ? 'mt-2' : ''">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-gray-5">
            {{ __('Prompt') }}
          </p>
          <p class="mt-0.5 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-snug text-ink-gray-7">
            {{ agent.prompt }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Autocomplete, call } from 'frappe-ui'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  reqd: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  // The account these options belong to — read off the sibling field the declaration names.
  source: { type: String, default: '' },
  // Whitelisted server methods, declared WITH the field. Never hardcoded here: a second voice provider is
  // a declaration change, not an edit to this component.
  optionsMethod: { type: String, required: true },
  detailMethod: { type: String, default: '' },
  // All three strings come from the field DECLARATION, never generated from the label — a generated
  // "Choose a from number (optional)" is what wrapped onto two centred lines in a 288px panel.
  placeholderText: { type: String, default: 'Select option' },
  emptyText: { type: String, default: 'Nothing on this account yet.' },
  gateText: { type: String, default: 'Pick a voice account first.' },
  // What the detail view is CALLED. This control is generic — the from-number picker uses it too — so
  // the word "agent" belongs to the declaration, not to this file.
  detailLabel: { type: String, default: 'what this says' },
})
const emit = defineEmits(['update:modelValue'])

const showPrompt = ref(false)
const loading = ref(false)

// Cached per account, and per (account, agent) for the detail. Keyed explicitly rather than through
// frappe-ui's `cache` option, because that key is fixed at creation and this one changes with the account —
// a fixed key would have served account A's agents under account B.
const agentCache = reactive({})
const detailCache = reactive({})

const entry = computed(() => agentCache[props.source] || null)
// `{options: [{value,label}], error}` — the ONE shape every provider picklist answers in, decided
// server-side so this control draws agents and phone numbers without knowing which it is looking at.
const agents = computed(() => entry.value?.options || [])
const fetchError = computed(() => entry.value?.error || null)
const loaded = computed(() => !!entry.value)
const agent = computed(() => detailCache[`${props.source}::${props.modelValue}`] || {})

const agentOptions = computed(() => agents.value)

const placeholder = computed(() => (props.source ? __(props.placeholderText) : __('—')))

async function loadAgents(force = false) {
  const account = props.source
  if (!account || (agentCache[account] && !force)) return
  loading.value = true
  try {
    const res = await call(props.optionsMethod, { account })
    agentCache[account] = { options: res?.options || [], error: res?.error || null }
  } catch (e) {
    // A thrown call is the same class of answer as a returned error — the provider could not be asked.
    agentCache[account] = { options: [], error: e?.messages?.[0] || e?.message || String(e) }
  } finally {
    loading.value = false
  }
}

async function loadAgent() {
  const { source: account, modelValue: agentId, detailMethod } = props
  if (!detailMethod || !account || !agentId) return
  const key = `${account}::${agentId}`
  if (detailCache[key]) return
  try {
    const res = await call(detailMethod, { account, agent_id: agentId })
    detailCache[key] = res?.agent || {}
  } catch {
    // The prompt view is an aid, not a gate: a detail that will not load leaves the picker fully usable.
    detailCache[key] = {}
  }
}

function refresh() {
  loadAgents(true)
}

// The account decides the vocabulary, so changing it invalidates a choice made under the old one: an agent
// id from account A is not an agent on account B, and leaving it selected would publish a node whose call
// the provider rejects. Cleared by EMIT — the inspector owns this node's config.
watch(
  () => props.source,
  (next, previous) => {
    showPrompt.value = false
    loadAgents()
    if (previous !== undefined && next !== previous && props.modelValue) {
      emit('update:modelValue', null)
    }
  },
  { immediate: true },
)

watch(() => [props.source, props.modelValue], loadAgent, { immediate: true })
</script>
