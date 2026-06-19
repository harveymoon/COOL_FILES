<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ComboboxContentEmits, ComboboxContentProps } from 'reka-ui';
import {
  ComboboxContent,
  ComboboxPortal,
  ComboboxViewport,
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaViewport,
  useForwardPropsEmits,
} from 'reka-ui';
import ScrollBar from '@/components/ui/scroll-area/scroll-bar.vue';

const props = withDefaults(defineProps<ComboboxContentProps>(), {
  position: 'popper',
  align: 'center',
  sideOffset: 4,
});
const emits = defineEmits<ComboboxContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ComboboxPortal>
    <ComboboxContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="['cool-files-ui-combobox-list', $attrs.class]"
    >
      <ScrollAreaRoot
        class="cool-files-ui-combobox-list__scroll-area"
        type="always"
      >
        <ScrollAreaViewport class="cool-files-ui-combobox-list__viewport">
          <ComboboxViewport>
            <slot />
          </ComboboxViewport>
        </ScrollAreaViewport>
        <ScrollBar orientation="vertical" />
        <ScrollAreaCorner />
      </ScrollAreaRoot>
    </ComboboxContent>
  </ComboboxPortal>
</template>

<style>
.cool-files-ui-combobox-list {
  position: relative;
  z-index: 50;
  width: 200px;
  max-height: 200px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  transform-origin: var(--reka-popover-content-transform-origin);
}

.cool-files-ui-combobox-list__scroll-area {
  position: relative;
  overflow: hidden;
  max-height: inherit;
  border-radius: var(--radius-md);
}

.cool-files-ui-combobox-list__viewport {
  width: 100%;
  height: 100%;
  max-height: inherit;
  overscroll-behavior: contain;
}

.cool-files-ui-combobox-list__viewport > div {
  width: 100%;
  max-width: 100%;
}

.cool-files-ui-combobox-list[data-state="open"][data-side="bottom"] {
  animation: cool-files-ui-slide-from-top 150ms ease-out;
}

.cool-files-ui-combobox-list[data-state="closed"][data-side="bottom"] {
  animation: cool-files-ui-slide-to-top 150ms ease-in;
}

.cool-files-ui-combobox-list[data-state="open"][data-side="top"] {
  animation: cool-files-ui-slide-from-bottom 150ms ease-out;
}

.cool-files-ui-combobox-list[data-state="closed"][data-side="top"] {
  animation: cool-files-ui-slide-to-bottom 150ms ease-in;
}

.cool-files-ui-combobox-list[data-state="open"][data-side="left"] {
  animation: cool-files-ui-slide-from-right 150ms ease-out;
}

.cool-files-ui-combobox-list[data-state="closed"][data-side="left"] {
  animation: cool-files-ui-slide-to-right 150ms ease-in;
}

.cool-files-ui-combobox-list[data-state="open"][data-side="right"] {
  animation: cool-files-ui-slide-from-left 150ms ease-out;
}

.cool-files-ui-combobox-list[data-state="closed"][data-side="right"] {
  animation: cool-files-ui-slide-to-left 150ms ease-in;
}

@keyframes cool-files-ui-slide-from-top {
  from {
    filter: blur(4px);
    transform: translateY(-1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }
}

@keyframes cool-files-ui-slide-to-top {
  from {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }

  to {
    filter: blur(4px);
    transform: translateY(-1rem) scaleY(0.98);
  }
}

@keyframes cool-files-ui-slide-from-bottom {
  from {
    filter: blur(4px);
    transform: translateY(1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }
}

@keyframes cool-files-ui-slide-to-bottom {
  from {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }

  to {
    filter: blur(4px);
    transform: translateY(1rem) scaleY(0.98);
  }
}

@keyframes cool-files-ui-slide-from-left {
  from {
    filter: blur(4px);
    transform: translateX(-1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }
}

@keyframes cool-files-ui-slide-to-left {
  from {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }

  to {
    filter: blur(4px);
    transform: translateX(-1rem) scaleY(0.98);
  }
}

@keyframes cool-files-ui-slide-from-right {
  from {
    filter: blur(4px);
    transform: translateX(1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }
}

@keyframes cool-files-ui-slide-to-right {
  from {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }

  to {
    filter: blur(4px);
    transform: translateX(1rem) scaleY(0.98);
  }
}
</style>
