<template>
  <!-- TatvaDoctorActivity — the lead page's own Tabs over one list per kind; `lead_activity` refuses a lead the rep cannot read. -->
  <div>
    <!-- Equal-width triggers and a list that sticks under the panel's top while its card scrolls; the same arbitrary-variant idiom Lead.vue styles its Tabs with. -->
    <Tabs
      v-model="tabIndex"
      :tabs="KINDS"
      class="!flex-none !overflow-visible [&_[role='tab']]:flex-1 [&_[role='tab']]:justify-center [&_[role='tablist']]:sticky [&_[role='tablist']]:top-0 [&_[role='tablist']]:z-10 [&_[role='tablist']]:gap-0 [&_[role='tablist']]:bg-surface-white [&_[role='tablist']]:px-0"
    >
      <template #tab-panel />
    </Tabs>
    <!-- A tab's list mounts the first time it is opened and stays: going back shows it at once, with no second fetch. -->
    <TatvaDoctorActivityList
      v-for="k in opened"
      v-show="k.value === kind.value"
      :key="k.value"
      :lead="lead"
      :kind="k"
      @open="emit('open')"
    />
  </div>
</template>

<script setup>
import { Tabs } from 'frappe-ui'
import { computed, markRaw, ref, watch } from 'vue'
import TatvaDoctorActivityList from '@/tatva/TatvaDoctorActivityList.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'

defineProps({
  lead: { type: String, required: true },
})

const emit = defineEmits(['open'])

// The kinds `lead_activity` serves, in a field rep's order, with the lead page's own icons and empty titles (Activities.vue).
const KINDS = [
  {
    label: __('Tasks'),
    value: 'task',
    icon: markRaw(TaskIcon),
    empty: __('No Tasks Found'),
  },
  {
    label: __('Calls'),
    value: 'call',
    icon: markRaw(PhoneIcon),
    empty: __('No Call History'),
  },
  {
    label: __('Notes'),
    value: 'note',
    icon: markRaw(NoteIcon),
    empty: __('No Notes Found'),
  },
  {
    label: __('Files'),
    value: 'attachment',
    icon: markRaw(AttachmentIcon),
    empty: __('No Attachments Found'),
  },
]

const tabIndex = ref(0)
const kind = computed(() => KINDS[tabIndex.value])
const opened = ref([KINDS[0]])
watch(kind, (k) => {
  if (!opened.value.includes(k)) opened.value.push(k)
})
</script>
