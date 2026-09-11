<!--
  TATVA: TatvaSelectBanner — the native bulk-select bar, pinned and made narrow enough for a phone.

  A WRAPPER, NOT A FORK. frappe-ui's `ListSelectBanner` is used exactly as it ships; this only gives it
  a containing block that does not scroll and passes a class through the seam the component itself
  offers. Every slot and every attr is forwarded, so a caller swaps the tag and changes nothing else.

  THE TWO DEFECTS IT CORRECTS, both from `ListSelectBanner.vue` + `ListView.vue`:

    <div class="relative … overflow-x-auto">      ListView root: the x-scroller AND the only
      <div class="w-max min-w-full">              positioned ancestor the banner can resolve against
          <div class="absolute inset-x-0 bottom-6">   so the bar tracks the SCROLLED content and
            <div class="min-w-[596px]" :class="$attrs.class">   drifts sideways off a wide list

  1. POSITIONING. `sticky` does NOT work here and it is worth saying why, because it is the obvious
     first answer: a sticky box is in flow, so its width resolves against the `w-max` inner div — the
     CONTENT width — and `inset-x-0 mx-auto` would go on centring the bar in the scrolled content. The
     only positioning that escapes a scroll container without measuring anything in JavaScript (C.6) is
     `fixed`, which resolves against the viewport. So this wrapper is a zero-height fixed strip along
     the bottom: the bar it contains is pinned there whatever the list does underneath.

     THE TRADE, stated: the bar now centres on the VIEWPORT rather than on the list column, so with the
     sidebar open it reads a little left of the list's centre. The behaviour it replaces was the bar
     leaving the screen entirely on a wide list, so this is the better of the two.

     `pointer-events-none` on the strip and `auto` on the bar, or an invisible full-width band would
     swallow clicks on the last row.
  2. WIDTH. `min-w-[596px]` is wider than a 390px phone. The component sets `inheritAttrs: false` and
     binds `:class="$attrs.class"` onto that exact div, so overriding it is the SANCTIONED seam, not a
     hack: `!min-w-0` releases the floor and `max-w-` keeps it inside the viewport with room to breathe.
     Above `sm` the original floor is restored, so desktop is unchanged.

  Nothing here touches list state: selections, `selectAll` and `unselectAll` stay the component's own
  and reach the caller through the same slot props they always did.
-->
<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-0">
    <ListSelectBanner
      v-bind="$attrs"
      class="pointer-events-auto !min-w-0 max-w-[calc(100vw-1.5rem)] flex-wrap gap-y-2 sm:!min-w-[596px] sm:max-w-none sm:flex-nowrap"
    >
      <!-- Every slot forwarded, named and scoped, so this is invisible to a caller. -->
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps" />
      </template>
    </ListSelectBanner>
  </div>
</template>

<script setup>
import { ListSelectBanner } from 'frappe-ui'

// The wrapper adds no props of its own; `inheritAttrs: false` so a caller's class/attrs reach the
// banner rather than landing on the positioning box, which owns its own layout.
defineOptions({ inheritAttrs: false })
</script>
