<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">

</script>

<template>
  <p
    class="cool-files-ui-card__description"
    :class="[$attrs.class]"
  >
    <slot />
  </p>
</template>

<style>
.cool-files-ui-card__description {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.25rem;
}
</style>
