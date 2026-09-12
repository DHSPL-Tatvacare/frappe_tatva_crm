<!-- TATVA: one row of a variable/field picker — the human name, and the reference it stands for STACKED
     underneath rather than beside it.

     frappe-ui's Autocomplete pins `description` to the right of the same row as a `flex-shrink-0` column
     with no width cap above it, so the popover grows to fit the longest one: a single 58-character ref
     (`crm_lead.custom_inclusions_or_additional_services_were_promised`) set the width of the whole control.
     The reference still earns its place — two fields can carry one label — so it moves to a second line and
     truncates like everything else.

     Lifted out of `workflows/FieldMap.vue`, which already answered this the same way, so the two pickers
     cannot drift. Rendered through `item-label`, a slot only the app's OWN Autocomplete exposes. -->
<template>
  <div v-if="option.description" class="flex min-w-0 flex-col gap-0.5">
    <div class="truncate font-medium text-ink-gray-7">{{ option.label }}</div>
    <div class="truncate text-xs text-ink-gray-5">{{ option.description }}</div>
  </div>
  <div v-else class="flex-1 truncate text-ink-gray-7">{{ option.label }}</div>
</template>

<script setup>
defineProps({ option: { type: Object, required: true } })
</script>
