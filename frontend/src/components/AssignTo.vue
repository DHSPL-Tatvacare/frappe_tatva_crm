<template>
  <Popover ref="popover" placement="bottom-end">
    <template #target="{ togglePopover }">
      <div class="flex items-center" @click="togglePopover">
        <component
          :is="assignees?.length == 1 ? 'Button' : 'div'"
          v-if="assignees?.length"
        >
          <MultipleAvatar :avatars="assignees" :hide-label="hideLabel" />
        </component>
        <!-- TATVA: `hideLabel` mirrors Filter.vue / SortBy.vue — icon-only on a narrow header, where "Assign To" wrapped the row. The label stays the real string: Button paints it only when there is no `icon`, and otherwise makes it the aria-label. -->
        <Button
          v-else
          :label="__('Assign To')"
          :icon="hideLabel ? 'user-plus' : undefined"
          :tooltip="hideLabel ? __('Assign To') : ''"
        />
      </div>
    </template>
    <template #body="{ isOpen }">
      <AssignToBody
        v-show="isOpen"
        v-model="assignees"
        :docname="docname"
        :doctype="doctype"
        :open="isOpen"
        :onUpdate="ownerField && saveAssignees"
      />
    </template>
  </Popover>
</template>
<script setup>
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import AssignToBody from '@/components/AssignToBody.vue'
import { useDocument } from '@/data/document'
import { toast, Popover, createResource } from 'frappe-ui'
import { usersStore } from '@/stores/users'
import { computed, ref } from 'vue'

const props = defineProps({
  doctype: { type: String, default: '' },
  docname: { type: String, default: '' },
  hideLabel: { type: Boolean, default: false }, // TATVA: icon-only trigger for a narrow header; defaults to today's behaviour
})

const { document } = useDocument(props.doctype, props.docname)

const assignees = defineModel({ type: Array, default: () => [] })

// TATVA: lets the lead page's A shortcut open the picker through Popover's own open(); `add` is the ⌘K palette's one-pick assign through this same save.
const popover = ref(null)
defineExpose({ open: () => popover.value?.open(), add })

const ownerField = computed(() => {
  if (props.doctype === 'CRM Lead') {
    return 'lead_owner'
  } else if (props.doctype === 'CRM Deal') {
    return 'deal_owner'
  } else {
    return null
  }
})

async function saveAssignees(
  addedAssignees,
  removedAssignees,
  addAssignees,
  removeAssignees,
) {
  if (removedAssignees.length) await removeAssignees.submit(removedAssignees)
  if (addedAssignees.length) await addAssignees.submit(addedAssignees)

  const nextAssignee = assignees.value.find(
    (a) => a.name !== document.doc[ownerField.value],
  )

  let owner = ownerField.value.replace('_', ' ')

  if (
    document.doc[ownerField.value] &&
    removedAssignees.includes(document.doc[ownerField.value])
  ) {
    document.doc[ownerField.value] = nextAssignee ? nextAssignee.name : ''
    document.save.submit()

    if (nextAssignee) {
      toast.info(
        __(
          'Since you removed {0} from the assignee, the {0} has been changed to the next available assignee {1}.',
          [owner, nextAssignee.label || nextAssignee.name],
        ),
      )
    } else {
      toast.info(
        __(
          'Since you removed {0} from the assignee, the {0} has also been removed.',
          [owner],
        ),
      )
    }
  } else if (!document.doc[ownerField.value] && nextAssignee) {
    document.doc[ownerField.value] = nextAssignee ? nextAssignee.name : ''
    toast.info(
      __('Since you added a new assignee, the {0} has been set to {1}.', [
        owner,
        nextAssignee.label || nextAssignee.name,
      ]),
    )
  }
}

// TATVA: one assignee added from outside the picker (the ⌘K palette), saved exactly as the picker saves, owner field included.
const { getUser } = usersStore()
const addAssignees = createResource({
  url: 'frappe.desk.form.assign_to.add',
  makeParams: (added) => ({ doctype: props.doctype, name: props.docname, assign_to: added }),
})
async function add(user) {
  const before = assignees.value
  assignees.value = [...before, { name: user, image: getUser(user).user_image, label: getUser(user).full_name }]
  try {
    await saveAssignees([user], [], addAssignees, null)
    toast.success(__('Assigned to {0}', [getUser(user).full_name || user]))
  } catch (error) {
    // Surfaced: the chip goes back and the server's own reason is shown.
    assignees.value = before
    toast.error(error?.messages?.[0] || __('Could not assign {0}', [user]))
  }
}
</script>
