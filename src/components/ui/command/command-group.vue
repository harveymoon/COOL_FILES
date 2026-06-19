<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ComboboxGroupProps } from 'reka-ui';
import { ComboboxGroup, ComboboxLabel } from 'reka-ui';

const props = defineProps<ComboboxGroupProps & {
  heading?: string;
}>();
</script>

<template>
  <ComboboxGroup
    v-bind="props"
    class="cool-files-ui-command-group text-xs"
  >
    <ComboboxLabel
      v-if="heading"
      class="cool-files-ui-command-group__heading"
    >
      {{ heading }}
    </ComboboxLabel>
    <slot />
  </ComboboxGroup>
</template>

<style>
.cool-files-ui-command-group {
  overflow: hidden;
  padding: 0.25rem;
  color: hsl(var(--foreground));
}

.cool-files-ui-command-group [cmdk-group-heading] {
  padding: 0.375rem 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem;
}

.cool-files-ui-command-group__heading {
  padding: 0.375rem 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem;
}
</style>
