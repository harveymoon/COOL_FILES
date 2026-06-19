<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { SlidersHorizontalIcon, RotateCcwIcon, PencilRulerIcon } from '@lucide/vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useNavCustomizeStore } from '@/stores/runtime/nav-customize';
import { SettingsItem } from '@/modules/settings';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { ToolbarItem, SidebarItem } from '@/types/user-settings';

const DEFAULT_TOOLBAR_ITEMS: ToolbarItem[] = [
  {
    kind: 'action',
    id: 'layoutList',
  },
  {
    kind: 'action',
    id: 'layoutGrid',
  },
  {
    kind: 'action',
    id: 'layoutColumns',
  },
  { kind: 'separator' },
  {
    kind: 'action',
    id: 'splitView',
  },
  {
    kind: 'action',
    id: 'infoPanel',
  },
  { kind: 'separator' },
  {
    kind: 'widget',
    id: 'commandPalette',
  },
  {
    kind: 'widget',
    id: 'globalSearch',
  },
  {
    kind: 'widget',
    id: 'lanShare',
  },
  {
    kind: 'widget',
    id: 'statusCenter',
  },
];

const DEFAULT_SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: 'home',
    visible: true,
  },
  {
    id: 'navigator',
    visible: true,
  },
  {
    id: 'dashboard',
    visible: true,
  },
  {
    id: 'settings',
    visible: true,
  },
  {
    id: 'extensions',
    visible: true,
  },
];

const { t } = useI18n();
const router = useRouter();
const userSettingsStore = useUserSettingsStore();
const navCustomizeStore = useNavCustomizeStore();

async function startCustomizing() {
  navCustomizeStore.enterEditMode();
  await router.push({ name: 'navigator' });
}

const autoShowDrives = computed(
  () => userSettingsStore.userSettings.navigator.sidebar?.autoShowDrives ?? true,
);

function setAutoShowDrives(value: boolean) {
  const sidebar = userSettingsStore.userSettings.navigator.sidebar;
  userSettingsStore.set('navigator.sidebar', {
    items: sidebar.items.map(item => ({ ...item })),
    autoShowDrives: value,
    pinnedPaths: [...(sidebar.pinnedPaths ?? [])],
  });
}

function resetToDefault() {
  userSettingsStore.set('navigator.toolbar', {
    items: DEFAULT_TOOLBAR_ITEMS.map(item => ({ ...item })),
  });
  userSettingsStore.set('navigator.sidebar', {
    items: DEFAULT_SIDEBAR_ITEMS.map(item => ({ ...item })),
    autoShowDrives: true,
    pinnedPaths: [],
  });
}
</script>

<template>
  <SettingsItem
    :title="t('settings.navigator.customizeTitle')"
    :description="t('settings.navigator.customizeDescription')"
    :icon="SlidersHorizontalIcon"
  >
    <div class="navigator-customize-launcher">
      <div class="navigator-customize-launcher__buttons">
        <Button
          variant="default"
          size="sm"
          @click="startCustomizing"
        >
          <PencilRulerIcon :size="14" />
          {{ t('settings.navigator.customizeButton') }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          @click="resetToDefault"
        >
          <RotateCcwIcon :size="14" />
          {{ t('settings.navigator.toolbarReset') }}
        </Button>
      </div>
      <label class="navigator-customize-launcher__toggle">
        <span class="navigator-customize-launcher__toggle-label">
          {{ t('settings.navigator.autoShowDrives') }}
        </span>
        <Switch
          :model-value="autoShowDrives"
          @update:model-value="setAutoShowDrives"
        />
      </label>
    </div>
  </SettingsItem>
</template>

<style scoped>
.navigator-customize-launcher {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}

.navigator-customize-launcher__buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.navigator-customize-launcher__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.navigator-customize-launcher__toggle-label {
  font-size: 13px;
}
</style>
