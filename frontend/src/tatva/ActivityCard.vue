<!-- ActivityCard — the ONE card shape for the activity type tabs AND the Activity rail (U9). Four slots:
     leading type-icon tile (optional `showTypeIcon`) · title + ONE primary badge + a CORNER for icon-only
     indicators · one flavor line · a muted foot (actor · when). Dumb (U11): no
     resource/store/fetch/router logic — it renders a normalized shape and EMITS; the parent area owns
     open/delete. `showTypeIcon=false` is RAIL MODE: no leading tile (the rail node carries the type) and
     no foot attribution (the rail header carries avatar · name · verb · when). One component, one boolean. -->
<template>
  <div
    class="group flex w-full cursor-pointer gap-3 rounded-md border border-outline-gray-modals bg-surface-cards px-3 py-2.5 text-left transition-colors hover:bg-surface-gray-1"
    :class="{ 'opacity-60': dimmed }"
    role="button"
    tabindex="0"
    @click="$emit('open')"
    @keydown.enter="$emit('open')"
  >
    <!-- LEADING TILE — a thumbnail (image files) or a hue-tinted type icon; hidden in rail mode. -->
    <div v-if="showTypeIcon" class="relative shrink-0">
      <slot name="tile">
        <div
          class="flex size-9 items-center justify-center overflow-hidden rounded-lg sm:size-10"
          :class="
            tile.kind === 'thumb'
              ? 'border border-outline-gray-modals bg-surface-white'
              : tint
          "
        >
          <img
            v-if="tile.kind === 'thumb'"
            :src="tile.src"
            :alt="title"
            class="size-full object-cover"
          />
          <component :is="tile.icon" v-else class="size-4" />
        </div>
      </slot>
      <span
        v-if="tile.dot"
        class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface-cards"
        :class="dotClass"
      />
    </div>

    <!-- BODY -->
    <div class="min-w-0 flex-1">
      <!-- title row: title · one primary badge · overflow -->
      <div class="flex items-start gap-2">
        <span
          class="min-w-0 flex-1 truncate text-sm font-medium text-ink-gray-9 sm:text-base"
        >
          {{ title }}
        </span>
        <Badge
          v-if="badge"
          :label="badge.label"
          :theme="badge.theme"
          variant="subtle"
          size="sm"
          class="mt-0.5 shrink-0"
        />
        <!-- CORNER — icon-only indicators (files: source + privacy). It rides the title row beside the badge, the same place the card already puts a small right-aligned marker. -->
        <div
          v-if="corner.length"
          class="mt-0.5 flex shrink-0 items-center gap-1.5 text-ink-gray-5"
        >
          <Tooltip
            v-for="(c, i) in corner"
            :key="i"
            :text="c.tooltip || ''"
            :disabled="!c.tooltip"
          >
            <component :is="c.iconComp" v-if="c.iconComp" class="size-3.5" />
            <FeatherIcon v-else :name="c.icon" class="size-3.5" />
          </Tooltip>
        </div>
        <Dropdown v-if="menu.length" :options="menuOptions" @click.stop>
          <Button
            icon="more-horizontal"
            variant="ghost"
            class="!size-6 shrink-0 opacity-0 group-hover:opacity-100"
            @click.stop.prevent
          />
        </Dropdown>
      </div>

      <!-- flavor line — the ONE middle slot. Always occupies its line (min-h, the row idiom SLASection uses): an adapter with nothing to say here must not make a shorter card than one that has. -->
      <p class="mt-0.5 min-h-4 truncate text-xs text-ink-gray-5">
        {{ flavor }}
      </p>

      <!-- foot: actor · when. Hidden in rail, where the header already carries both — and hidden means NO ROW, which is what keeps a file card the same height as a note card beside it. -->
      <div
        v-if="showTypeIcon"
        class="mt-1.5 flex items-center gap-1.5 text-xs text-ink-gray-5"
      >
        <RouterLink
          v-if="actor.to"
          :to="actor.to"
          class="flex min-w-0 items-center gap-1 text-ink-gray-6 hover:text-ink-gray-9 hover:underline"
          @click.stop
        >
          <component
            :is="actor.iconComp"
            v-if="actor.iconComp"
            class="size-3.5 shrink-0"
          />
          <span class="truncate">{{ actor.label }}</span>
        </RouterLink>
        <template v-else>
          <Avatar :label="actor.label" :image="actor.image" size="xs" />
          <span class="truncate">{{ actor.label }}</span>
        </template>
        <span aria-hidden="true">·</span>
        <Tooltip :text="formatDate(at)">
          <span class="whitespace-nowrap">{{ timeAgo(at) }}</span>
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  FeatherIcon,
  Tooltip,
} from 'frappe-ui'
import { formatDate, timeAgo } from '@/utils'

const props = defineProps({
  // Whether the leading type-icon tile shows. ON in the type tabs (the card's identity); OFF in the rail
  // (the rail node carries the type) — the SAME boolean also hides the foot attribution in rail context.
  showTypeIcon: { type: Boolean, default: true },
  // { kind: 'icon'|'thumb', icon?, tint?, src?, dot? } — dot is a Badge theme name.
  tile: { type: Object, default: () => ({ kind: 'icon' }) },
  title: { type: String, default: '' },
  badge: { type: Object, default: null }, // { label, theme } | null — the ONE loud status
  flavor: { type: String, default: '' }, // the ONE middle line (text or the adapter's dot-joined elements)
  corner: { type: Array, default: () => [] }, // [{ icon?, iconComp?, tooltip? }] — icon-only, no labels
  // { label, image } human, OR { label, iconComp, to } for an automation deep-link (renders no avatar).
  actor: { type: Object, default: () => ({ label: '', image: '' }) },
  at: { type: String, default: '' },
  dimmed: { type: Boolean, default: false },
  menu: { type: Array, default: () => [] }, // [{ label, icon, key }]
})
const emit = defineEmits(['open', 'action'])

// Theme name → tile tint / dot fill, same hue pairing as the search tiles (surface tint + own ink, never ink-*-1).
const TINT = {
  blue: 'bg-surface-blue-2 text-ink-blue-2',
  green: 'bg-surface-green-2 text-ink-green-3',
  amber: 'bg-surface-amber-2 text-ink-amber-3',
  red: 'bg-surface-red-1 text-ink-red-4',
  gray: 'bg-surface-gray-2 text-ink-gray-7',
}
const DOT = {
  green: 'bg-surface-green-3',
  red: 'bg-surface-red-4',
  blue: 'bg-surface-blue-2',
  amber: 'bg-surface-amber-2',
  gray: 'bg-surface-gray-4',
}
const tint = computed(() => TINT[props.tile.tint] || TINT.gray)
const dotClass = computed(() => DOT[props.tile.dot] || DOT.gray)

// Overflow items map to an emitted key — the parent decides what each does.
const menuOptions = computed(() =>
  props.menu.map((m) => ({
    label: m.label,
    icon: m.icon,
    onClick: () => emit('action', m.key),
  })),
)
</script>
