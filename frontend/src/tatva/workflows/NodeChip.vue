<!-- TATVA: a node type's chip, solid category colour with a white icon, identical on the canvas card, the inspector, the palette and the run log. -->
<template>
  <span
    class="flex h-5 w-5 shrink-0 items-center justify-center rounded"
    :class="categoryFor(type).chip"
  >
    <component :is="iconFor(type)" class="h-3 w-3" />
  </span>
</template>

<script setup>
import { categoryFor, iconFor } from './nodeCatalog'

defineProps({ type: { type: String, required: true } })
</script>
