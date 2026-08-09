import { createResource } from 'frappe-ui'
import { computed, ref } from 'vue'

const integrations = ref({})
export const defaultCallingMedium = ref('')

// TATVA: the phone icon is drawn by OUR switch, not by a credential-less `CRM Exotel Settings` tick.
const callsSwitch = createResource({
  url: 'tatva_connect.telephony.api.calls_enabled',
  cache: 'Telephony Calls Enabled',
  auto: true,
})

// Derived from the resource, not mirrored into a ref — one source of truth, and it tracks revalidation.
export const callEnabled = computed(() => Boolean(callsSwitch.data?.enabled))

// TATVA: Twilio/Exotel config feeds their Settings panels only, so the panel asks for it — not app load.
const vendorConfig = createResource({
  url: 'crm.integrations.api.is_call_integration_enabled',
  cache: 'Is Call Integration Enabled',
  onSuccess: (data) => {
    integrations.value = data.integrations || {}
    defaultCallingMedium.value = data.default_calling_medium
  },
})

export function setEnabled(name, value) {
  integrations.value[name] = value
}

export function useTelephony() {
  // `!data && !loading`: two panels co-exist for a tick on a tab switch and would both fire the request.
  if (!vendorConfig.data && !vendorConfig.loading) vendorConfig.fetch()

  const allIntegrations = computed(() =>
    Object.entries(integrations.value).map(([name, enabled]) => ({
      name,
      enabled,
    })),
  )

  function isEnabled(name) {
    return Boolean(integrations.value[name])
  }

  const isAnyEnabled = computed(() =>
    Object.values(integrations.value).some(Boolean),
  )

  return { integrations: allIntegrations, isEnabled, isAnyEnabled }
}
