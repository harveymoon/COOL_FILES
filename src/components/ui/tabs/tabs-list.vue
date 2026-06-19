<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { TabsList, type TabsListProps } from 'reka-ui';

const props = defineProps<TabsListProps>();
</script>

<template>
  <TabsList
    v-bind="props"
    class="cool-files-ui-tabs-list"
  >
    <slot />
  </TabsList>
</template>

<style>
.cool-files-ui-tabs-list {
  display: inline-flex;
  overflow: auto hidden;
  max-width: 100%;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: var(--radius-md);
  background-color: hsl(var(--secondary));
  color: hsl(var(--muted-foreground));
  scrollbar-color: hsl(var(--border)) transparent;
  scrollbar-width: thin;
}

.cool-files-ui-tabs-list::-webkit-scrollbar {
  height: 6px;
}

.cool-files-ui-tabs-list::-webkit-scrollbar-track {
  background: transparent;
}

.cool-files-ui-tabs-list::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background-color: hsl(var(--border));
}

.cool-files-ui-tabs-list::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--border) / 80%);
}
</style>
