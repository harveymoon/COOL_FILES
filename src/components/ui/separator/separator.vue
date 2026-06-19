<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { Separator, type SeparatorProps } from 'reka-ui';

const props = defineProps<
  SeparatorProps & { label?: string }
>();
</script>

<template>
  <Separator
    v-bind="props"
    class="cool-files-ui-separator"
  >
    <span
      v-if="props.label"

      class="cool-files-ui-separator__label"
    >{{ props.label }}</span>
  </Separator>
</template>

<style>
.cool-files-ui-separator {
  position: relative;
  flex-shrink: 0;
  background-color: hsl(var(--border));
}

.cool-files-ui-separator[data-orientation="vertical"] {
  width: 1px;
  height: 100%;
}

.cool-files-ui-separator[data-orientation="horizontal"] {
  width: 100%;
  height: 1px;
}

.cool-files-ui-separator__label {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  transform: translate(-50%, -50%);
}

.cool-files-ui-separator[data-orientation="vertical"] .cool-files-ui-separator__label {
  width: 1px;
  padding: 0 0.25rem;
  padding-block: 0.5rem;
}

.cool-files-ui-separator[data-orientation="horizontal"] .cool-files-ui-separator__label {
  height: 1px;
  padding: 0.25rem 0;
  padding-inline: 0.5rem;
}
</style>
