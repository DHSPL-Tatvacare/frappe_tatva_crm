<template>
  <div
    v-if="avatars?.length"
    class="mr-1.5 flex cursor-pointer items-center"
    :class="[
      avatars?.length > 1 ? 'flex-row-reverse' : 'truncate [&>div]:truncate',
    ]"
  >
    <Tooltip v-if="avatars?.length == 1" :text="avatars[0].name">
      <div class="flex items-center gap-2 text-base">
        <Avatar
          shape="circle"
          :image="avatars[0].image"
          :label="avatars[0].label"
          :size="size"
        />
        <!-- TATVA: `hideLabel` mirrors Filter.vue / AssignTo.vue — a lone assignee reads as a bare circle on a narrow header, like the stacked case already does. The Tooltip above still carries the name. -->
        <div v-if="!hideLabel" class="truncate">{{ avatars[0].label }}</div>
      </div>
    </Tooltip>
    <Tooltip
      v-for="avatar in reverseAvatars"
      v-else
      :key="avatar.name"
      :text="avatar.name"
    >
      <Avatar
        class="user-avatar -mr-1.5 transform ring-2 ring-outline-white transition hover:z-10 hover:scale-110"
        shape="circle"
        :image="avatar.image"
        :label="avatar.label"
        :size="size"
        :data-name="avatar.name"
      />
    </Tooltip>
  </div>
</template>
<script setup>
import { Avatar, Tooltip } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps({
  avatars: { type: Array, default: () => [] },
  size: { type: String, default: 'md' },
  hideLabel: { type: Boolean, default: false }, // TATVA: avatar only, no name — defaults to today's behaviour
})
const reverseAvatars = computed(() => [...props.avatars].reverse())
</script>
