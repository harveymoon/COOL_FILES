<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  CheckboxIndicator,
  CheckboxRoot,
  type CheckboxRootEmits,
  type CheckboxRootProps,
  useForwardPropsEmits,
} from 'reka-ui';
import { CheckIcon } from '@lucide/vue';

const props = defineProps<CheckboxRootProps>();

const emits = defineEmits<CheckboxRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    class="cool-files-ui-checkbox"
  >
    <CheckboxIndicator class="cool-files-ui-checkbox__indicator">
      <CheckIcon class="cool-files-ui-checkbox__icon" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<style>
.cool-files-ui-checkbox {
  display: flex;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--primary));
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition-duration: 150ms;
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.cool-files-ui-checkbox:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.cool-files-ui-checkbox:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.cool-files-ui-checkbox[data-state="checked"] {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.cool-files-ui-checkbox[data-state="unchecked"] {
  background-color: transparent;
}

.cool-files-ui-checkbox__indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

.cool-files-ui-checkbox__icon {
  width: 0.75rem;
  height: 0.75rem;
  stroke-width: 3;
}
</style>
