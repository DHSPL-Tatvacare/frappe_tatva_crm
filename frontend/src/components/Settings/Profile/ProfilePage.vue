<template>
  <ProfileSettings
    v-if="step === 'profile-settings'"
    @updateStep="updateStep"
  />
  <UserEmailSettings
    v-else-if="step === 'user-email-settings'"
    @updateStep="updateStep"
  />
</template>
<script setup>
import ProfileSettings from './ProfileSettings.vue'
import UserEmailSettings from './UserEmailSettings.vue'
import { computed, ref } from 'vue'
import { useSheetDrill } from '@/tatva/settingsSheet'

const step = ref('profile-settings')
// TATVA: in the mobile Settings sheet the sheet's one header names Email Settings and its back returns to Profile.
useSheetDrill(
  computed(() => (step.value === 'user-email-settings' ? __('Email Settings') : '')),
  () => (step.value = 'profile-settings'),
)

function updateStep(newStep) {
  step.value = newStep
}
</script>
