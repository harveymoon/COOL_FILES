<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">

</script>

<template>
  <div
    class="cool-files-ui-card"
    :class="[$attrs.class]"
  >
    <slot />
  </div>
</template>

<style>
.cool-files-ui-card {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 5%);
  color: hsl(var(--card-foreground));
}
</style>
