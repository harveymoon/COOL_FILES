<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ComboboxItemEmits, ComboboxItemProps } from 'reka-ui';
import { ComboboxItem, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<ComboboxItemProps>();
const emits = defineEmits<ComboboxItemEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ComboboxItem
    v-bind="forwarded"
    class="cool-files-ui-command-item"
  >
    <slot />
  </ComboboxItem>
</template>

<style>
.cool-files-ui-command-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  cursor: default;
  font-size: 0.875rem;
  line-height: 1.25rem;
  outline: none;
  user-select: none;
}

.cool-files-ui-command-item[data-highlighted] {
  background-color: hsl(var(--secondary));
  color: hsl(var(--popover-foreground) / 80%);
}

.cool-files-ui-command-item[data-disabled] {
  opacity: 0.5;
  pointer-events: none;
}
</style>
