<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!--
  Edit-mode wrapper around a normal home tile. Keeps the slotted card identical
  to its non-edit appearance, but suppresses navigation clicks (so dragging /
  arranging never opens a folder) and overlays an optional remove button. The
  tile stays draggable via the parent smooth-dnd <Draggable>.
-->

<script setup lang="ts">
import { PencilIcon, XIcon } from '@lucide/vue';

withDefaults(defineProps<{
  removable?: boolean;
  editable?: boolean;
}>(), {
  removable: false,
  editable: false,
});

const emit = defineEmits<{
  remove: [];
  edit: [];
}>();

// Swallow clicks on the card during capture so the slotted tile never
// navigates, while still letting the overlay buttons receive their own clicks.
function onCaptureClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;

  if (target?.closest('.home-edit-card__action')) {
    return;
  }

  event.stopPropagation();
  event.preventDefault();
}
</script>

<template>
  <div
    class="home-edit-card"
    @click.capture="onCaptureClick"
  >
    <slot />

    <div class="home-edit-card__actions">
      <button
        v-if="editable"
        type="button"
        class="home-edit-card__action home-edit-card__edit"
        :title="$t('contextMenus.dirItem.editCard')"
        @pointerdown.stop
        @mousedown.stop
        @click.stop="emit('edit')"
      >
        <PencilIcon :size="13" />
      </button>
      <button
        v-if="removable"
        type="button"
        class="home-edit-card__action home-edit-card__remove"
        :title="$t('remove')"
        @pointerdown.stop
        @mousedown.stop
        @click.stop="emit('remove')"
      >
        <XIcon :size="14" />
      </button>
    </div>
  </div>
</template>

<style>
.home-edit-card {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.home-edit-card:active {
  cursor: grabbing;
}

/* The slotted card sets its own `cursor: pointer`; keep the grab affordance
   across the whole tile in edit mode (except the overlay action buttons). */
.home-edit-card > :not(.home-edit-card__actions) {
  cursor: inherit;
}

/* Subtle affordance that the tile is in an editable/draggable state. */
.home-edit-card::after {
  position: absolute;
  inset: 0;
  border: 1px dashed hsl(var(--primary) / 35%);
  border-radius: var(--radius);
  content: '';
  pointer-events: none;
}

.home-edit-card__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: flex;
  gap: 4px;
}

.home-edit-card__action {
  display: flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background) / 85%);
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.home-edit-card__edit:hover {
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
  transition: background-color var(--hover-transition-duration-in);
}

.home-edit-card__remove:hover {
  background-color: hsl(var(--destructive) / 15%);
  color: hsl(var(--destructive));
  transition: background-color var(--hover-transition-duration-in);
}
</style>
