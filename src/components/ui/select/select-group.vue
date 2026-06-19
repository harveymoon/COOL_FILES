<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SelectGroup, type SelectGroupProps } from 'reka-ui';

const props = defineProps<SelectGroupProps>();
</script>

<template>
  <SelectGroup
    class="cool-files-ui-select-group"
    v-bind="props"
  >
    <slot />
  </SelectGroup>
</template>

<style>
.cool-files-ui-select-group {
  width: 100%;
  padding: 0.25rem;
}
</style>
