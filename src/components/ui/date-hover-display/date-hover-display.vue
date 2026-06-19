<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useRelativeDateDisplay } from '@/composables/use-relative-date-display';
import {
  formatAbsoluteDateDisplay,
  formatRelativeDateDisplay,
} from '@/utils/relative-date-display';

const props = withDefaults(defineProps<{
  timestamp: number;
  referenceNow: number;
  relativeDisplay?: boolean;
}>(), {
  relativeDisplay: true,
});

const userSettingsStore = useUserSettingsStore();
const { t, locale } = useI18n();
const { isEnabled } = useRelativeDateDisplay(() => props.relativeDisplay);

const absolute = computed(() => {
  return formatAbsoluteDateDisplay(
    props.timestamp,
    userSettingsStore.userSettings.dateTime,
    locale.value,
  );
});

const primary = computed(() => {
  if (!props.timestamp) {
    return '-';
  }

  if (!isEnabled.value) {
    return absolute.value;
  }

  return formatRelativeDateDisplay({
    timestamp: props.timestamp,
    referenceNowMs: props.referenceNow,
    dateTimeOptions: userSettingsStore.userSettings.dateTime,
    appLocale: locale.value,
    translate: t,
    relativeDisplay: props.relativeDisplay,
  });
});

const showHoverSwap = computed(() => {
  if (!props.timestamp) {
    return false;
  }

  return primary.value !== absolute.value;
});
</script>

<template>
  <span
    v-if="showHoverSwap"
    class="cool-files-date-hover cool-files-date-hover--relative"
  >
    <span class="cool-files-date-hover__primary">{{ primary }}</span>
    <span class="cool-files-date-hover__absolute">{{ absolute }}</span>
  </span>
  <span
    v-else
    class="cool-files-date-hover"
  >{{ primary }}</span>
</template>

<style scoped>
.cool-files-date-hover {
  display: inline-block;
  max-width: 100%;
  vertical-align: bottom;
}

.cool-files-date-hover--relative {
  display: inline-grid;
  cursor: default;
  grid-template-columns: max-content;
  grid-template-rows: max-content;
}

.cool-files-date-hover__primary,
.cool-files-date-hover__absolute {
  grid-area: 1 / 1;
  place-self: start;
  pointer-events: none;
  transition: opacity 0.22s ease-out;
}

.cool-files-date-hover__primary {
  opacity: 1;
}

.cool-files-date-hover__absolute {
  opacity: 0;
}

.cool-files-date-hover--relative:hover .cool-files-date-hover__primary {
  opacity: 0;
}

.cool-files-date-hover--relative:hover .cool-files-date-hover__absolute {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .cool-files-date-hover__primary,
  .cool-files-date-hover__absolute {
    transition-duration: 0.01ms;
  }
}
</style>
