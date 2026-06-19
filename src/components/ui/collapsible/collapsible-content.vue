<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { CollapsibleContent, type CollapsibleContentProps, useForwardProps } from 'reka-ui';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<CollapsibleContentProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <CollapsibleContent
    v-bind="{ ...forwarded, ...$attrs }"
    class="cool-files-ui-collapsible-content"
    :class="$attrs.class"
  >
    <slot />
  </CollapsibleContent>
</template>

<style>
.cool-files-ui-collapsible-content {
  overflow: hidden;
}

.cool-files-ui-collapsible-content[data-state="open"] {
  animation: cool-files-ui-collapsible-down 0.2s ease-out;
}

.cool-files-ui-collapsible-content[data-state="closed"] {
  animation: cool-files-ui-collapsible-up 0.2s ease-out;
}
</style>
