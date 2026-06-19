<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  useLoadAnimations,
  LOAD_ANIMATIONS_DURATION_MIN_MS,
  LOAD_ANIMATIONS_DURATION_MAX_MS,
  LOAD_ANIMATIONS_STAGGER_MIN_MS,
  LOAD_ANIMATIONS_STAGGER_MAX_MS,
} from '@/composables/use-load-animations';
import { SettingsItem } from '@/modules/settings';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const { applyLoadAnimations } = useLoadAnimations();

const loadAnimations = computed(() => userSettingsStore.userSettings.loadAnimations);

function persistAndApply(next: {
  enabled: boolean;
  durationMs: number;
  staggerStepMs: number;
}) {
  userSettingsStore.set('loadAnimations', next);
  applyLoadAnimations(next);
}

function setEnabled(enabled: boolean) {
  persistAndApply({
    ...loadAnimations.value,
    enabled,
  });
}

function setDuration(value: number[] | undefined) {
  if (!value) {
    return;
  }

  persistAndApply({
    ...loadAnimations.value,
    durationMs: value[0],
  });
}

function setStaggerStep(value: number[] | undefined) {
  if (!value) {
    return;
  }

  persistAndApply({
    ...loadAnimations.value,
    staggerStepMs: value[0],
  });
}
</script>

<template>
  <SettingsItem
    :title="t('settings.appearance.loadAnimations.title')"
    :description="t('settings.appearance.loadAnimations.description')"
  >
    <div class="load-animations">
      <div class="load-animations__row">
        <span class="load-animations__label">{{ t('settings.appearance.loadAnimations.enable') }}</span>
        <Switch
          :model-value="loadAnimations.enabled"
          @update:model-value="setEnabled"
        />
      </div>

      <div
        class="load-animations__row load-animations__row--slider"
        :class="{ 'load-animations__row--disabled': !loadAnimations.enabled }"
      >
        <span class="load-animations__label">{{ t('settings.appearance.loadAnimations.speed') }}</span>
        <div class="load-animations__control">
          <Slider
            :model-value="[loadAnimations.durationMs]"
            :min="LOAD_ANIMATIONS_DURATION_MIN_MS"
            :max="LOAD_ANIMATIONS_DURATION_MAX_MS"
            :step="20"
            :disabled="!loadAnimations.enabled"
            @update:model-value="setDuration"
          />
          <span class="load-animations__value">{{ t('settings.appearance.loadAnimations.milliseconds', { value: loadAnimations.durationMs }) }}</span>
        </div>
      </div>

      <div
        class="load-animations__row load-animations__row--slider"
        :class="{ 'load-animations__row--disabled': !loadAnimations.enabled }"
      >
        <span class="load-animations__label">{{ t('settings.appearance.loadAnimations.cascade') }}</span>
        <div class="load-animations__control">
          <Slider
            :model-value="[loadAnimations.staggerStepMs]"
            :min="LOAD_ANIMATIONS_STAGGER_MIN_MS"
            :max="LOAD_ANIMATIONS_STAGGER_MAX_MS"
            :step="4"
            :disabled="!loadAnimations.enabled"
            @update:model-value="setStaggerStep"
          />
          <span class="load-animations__value">{{ t('settings.appearance.loadAnimations.milliseconds', { value: loadAnimations.staggerStepMs }) }}</span>
        </div>
      </div>
    </div>
  </SettingsItem>
</template>

<style scoped>
.load-animations {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}

.load-animations__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.load-animations__row--slider {
  align-items: center;
}

.load-animations__row--disabled {
  opacity: 0.5;
}

.load-animations__label {
  font-size: 13px;
}

.load-animations__control {
  display: flex;
  width: 260px;
  max-width: 60%;
  align-items: center;
  gap: 12px;
}

.load-animations__value {
  min-width: 56px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: right;
}
</style>
