<!-- TATVA: a picker whose vocabulary only the PROVIDER knows. The options are fetched SERVER-side from the account a sibling field names — the credential is a Password column and never reaches this component. Cached per account for the life of the page, so re-opening the inspector or moving between nodes on the same account costs nothing, with an explicit Refresh for the case the author has just added an agent on the provider's dashboard. "No options" and "we could not ask the provider" are different answers and are shown differently: an empty list is a fact about the account, an error is a fact about the connection, and an author who cannot tell them apart goes looking in the wrong place. -->
<template>
  <div>
    <div class="mb-1 flex items-baseline justify-end gap-2">
      <!-- A secondary action, sized BELOW the label so it never reads as a second field name. Hidden entirely while read-only: an author who cannot edit has nothing to refresh. -->
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

    <FieldPicker
      :modelValue="modelValue"
      :options="agents"
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

    <!-- The prompt the chosen agent will actually speak from. Picking an agent by id alone is picking blind; this is the one place an author can read what it says before a patient hears it. -->
    <div v-if="modelValue && (agent.prompt || agent.welcome_message)" class="mt-2">
      <button
        type="button"
        class="flex items-center gap-1 text-xs text-ink-gray-6 hover:text-ink-gray-8"
        @click="showPrompt = !showPrompt"
      >
        <FeatherIcon name="chevron-right" class="h-3 w-3 transition-transform" :class="{ 'rotate-90': showPrompt }" />
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
import { computed, ref, watch } from 'vue'
import { FeatherIcon, createResource } from 'frappe-ui'
// The picker every other inspector value field mounts: one row shape, one width, one page size.
import FieldPicker from '@/tatva/FieldPicker.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  // The account these options belong to — read off the sibling field the declaration names.
  source: { type: String, default: '' },
  // Whitelisted server methods, declared WITH the field. Never hardcoded here: a second voice provider is a declaration change, not an edit to this component.
  optionsMethod: { type: String, required: true },
  detailMethod: { type: String, default: '' },
  // All three strings come from the field DECLARATION, never generated from the label — a generated "Choose a from number (optional)" is what wrapped onto two centred lines in a 288px panel.
  placeholderText: { type: String, default: 'Select option' },
  emptyText: { type: String, default: 'Nothing on this account yet.' },
  gateText: { type: String, default: 'Pick a voice account first.' },
  // What the detail view is CALLED. This control is generic — the from-number picker uses it too — so the word "agent" belongs to the declaration, not to this file.
  detailLabel: { type: String, default: 'what this says' },
})
const emit = defineEmits(['update:modelValue'])

const showPrompt = ref(false)

// One shared resource per method and account (frappe-ui's cache): the agent and from-number pickers on one account never share a list, and remounting the inspector asks nothing again.
function remoteResource(method, params) {
  // A failure is shown inline off `.error`, so the global error toast is not wanted.
  return createResource({ url: method, params, cache: ['tatva:remote-select', method, params], onError() {} })
}
function ask(resource) {
  // The failure is already on `.error`; the rejection carries nothing more.
  if (resource && !resource.fetched && !resource.loading && !resource.error) resource.fetch().catch(() => {})
}

const options = computed(() => (props.source ? remoteResource(props.optionsMethod, { account: props.source }) : null))
const detail = computed(() =>
  props.detailMethod && props.source && props.modelValue
    ? remoteResource(props.detailMethod, { account: props.source, agent_id: props.modelValue })
    : null,
)

const loading = computed(() => Boolean(options.value?.loading))
// One `{options, error}` shape for every provider list; a failed ask shows none, since frappe-ui keeps stale data on error.
const agents = computed(() => (options.value?.error ? [] : options.value?.data?.options || []))
// A thrown call is the same class of answer as a returned error — the provider could not be asked.
const fetchError = computed(() => {
  const e = options.value?.error
  return options.value?.data?.error || (e ? e.messages?.[0] || e.message || String(e) : null)
})
const loaded = computed(() => Boolean(options.value?.data || options.value?.error))
// The prompt view is an aid, not a gate: a detail that will not load leaves the picker fully usable.
const agent = computed(() => detail.value?.data?.agent || {})

function refresh() {
  options.value?.reload().catch(() => {})
}

// The account decides the vocabulary, so changing it invalidates a choice made under the old one: an agent id from account A is not an agent on account B, and leaving it selected would publish a node whose call the provider rejects. Cleared by EMIT — the inspector owns this node's config.
watch(
  () => props.source,
  (next, previous) => {
    showPrompt.value = false
    ask(options.value)
    if (previous !== undefined && next !== previous && props.modelValue) {
      emit('update:modelValue', null)
    }
  },
  { immediate: true },
)

watch(detail, ask, { immediate: true })
</script>
