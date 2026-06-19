<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!--
  Custom "columns layout" icon. Drawn to match the sibling lucide List and Grid
  icons used in the same layout switcher: 24x24 viewBox, currentColor stroke,
  stroke-width 2, rounded caps/joins. Rendered as three separate tall rounded
  bars (rx=1) so it shares the Grid icon's "separate rounded shapes" style
  rather than lucide's boxed Columns3 (single bordered rect with dividers).
-->

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number;
}>(), {
  size: 24,
});
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect
      x="3"
      y="3"
      width="4"
      height="18"
      rx="1"
    />
    <rect
      x="10"
      y="3"
      width="4"
      height="18"
      rx="1"
    />
    <rect
      x="17"
      y="3"
      width="4"
      height="18"
      rx="1"
    />
  </svg>
</template>
