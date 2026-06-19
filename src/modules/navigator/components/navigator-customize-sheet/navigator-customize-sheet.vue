<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Container, Draggable } from 'vue3-smooth-dnd';
import { SeparatorVerticalIcon, CheckIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/runtime/app';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useNavCustomizeStore, NAV_CUSTOMIZE_DRAG_GROUP } from '@/stores/runtime/nav-customize';
import type { ToolbarActionId, ToolbarWidgetId, SidebarRouteId } from '@/types/user-settings';
import ColumnsLayoutIcon from '@/modules/navigator/components/navigator-toolbar-actions/columns-layout-icon.vue';
import {
  TOOLBAR_ACTION_DEFINITIONS,
  getToolbarActionDefinition,
} from '@/modules/navigator/components/navigator-toolbar-actions/toolbar-actions';
import {
  TOOLBAR_WIDGET_DEFINITIONS,
  getToolbarWidgetDefinition,
} from '@/modules/navigator/components/navigator-toolbar-actions/toolbar-widgets';

type PoolItem
  = {
    type: 'toolbar';
    id: ToolbarActionId;
  }
  | {
    type: 'widget';
    id: ToolbarWidgetId;
  }
  | {
    type: 'sidebar';
    id: SidebarRouteId;
  };

const { t } = useI18n();
const appStore = useAppStore();
const userSettingsStore = useUserSettingsStore();
const navCustomizeStore = useNavCustomizeStore();

const editing = computed(() => navCustomizeStore.isEditMode);

const usedToolbarActionIds = computed(
  () => new Set(
    (userSettingsStore.userSettings.navigator.toolbar?.items ?? [])
      .filter((item): item is {
        kind: 'action';
        id: ToolbarActionId;
      } => item.kind === 'action')
      .map(item => item.id),
  ),
);

const usedToolbarWidgetIds = computed(
  () => new Set(
    (userSettingsStore.userSettings.navigator.toolbar?.items ?? [])
      .filter((item): item is {
        kind: 'widget';
        id: ToolbarWidgetId;
      } => item.kind === 'widget')
      .map(item => item.id),
  ),
);

const pagesByName = computed(
  () => new Map(appStore.pages.map(page => [String(page.name), page])),
);

// Combined pool: toolbar actions + widgets not on the toolbar + sidebar pages not visible.
const poolItems = computed<PoolItem[]>(() => {
  const toolbarPool: PoolItem[] = TOOLBAR_ACTION_DEFINITIONS
    .filter(definition => !usedToolbarActionIds.value.has(definition.id))
    .map(definition => ({
      type: 'toolbar',
      id: definition.id,
    }));

  const widgetPool: PoolItem[] = TOOLBAR_WIDGET_DEFINITIONS
    .filter(definition => !usedToolbarWidgetIds.value.has(definition.id))
    .map(definition => ({
      type: 'widget',
      id: definition.id,
    }));

  const sidebarConfig = userSettingsStore.userSettings.navigator.sidebar?.items ?? [];
  const sidebarPool: PoolItem[] = sidebarConfig
    .filter(item => !item.visible && pagesByName.value.has(item.id))
    .map(item => ({
      type: 'sidebar',
      id: item.id,
    }));

  return [...toolbarPool, ...widgetPool, ...sidebarPool];
});

function poolPayload(index: number) {
  const item = poolItems.value[index];

  if (item.type === 'toolbar') {
    return {
      kind: 'action',
      id: item.id,
    };
  }

  if (item.type === 'widget') {
    return {
      kind: 'widget',
      id: item.id,
    };
  }

  return { sidebarId: item.id };
}

function separatorPayload() {
  return { kind: 'separator' };
}

function poolIcon(item: PoolItem) {
  if (item.type === 'sidebar') {
    return pagesByName.value.get(item.id)?.icon;
  }

  if (item.type === 'widget') {
    return getToolbarWidgetDefinition(item.id)?.icon;
  }

  if (item.id === 'layoutColumns') {
    return ColumnsLayoutIcon;
  }

  return getToolbarActionDefinition(item.id)?.icon;
}

function poolLabel(item: PoolItem): string {
  if (item.type === 'sidebar') {
    return pagesByName.value.get(item.id)?.title ?? item.id;
  }

  if (item.type === 'widget') {
    const widgetDefinition = getToolbarWidgetDefinition(item.id);
    return widgetDefinition ? t(widgetDefinition.labelKey) : item.id;
  }

  const definition = getToolbarActionDefinition(item.id);
  return definition ? t(definition.labelKey) : item.id;
}

// Items leaving the pool are added by the destination bar's own drop handler;
// the pool is derived from settings and recomputes, so this is a no-op.
function onPoolDrop() {}
</script>

<template>
  <Transition name="navigator-customize-sheet">
    <div
      v-if="editing"
      class="navigator-customize-sheet"
    >
      <div class="navigator-customize-sheet__header">
        <div class="navigator-customize-sheet__heading">
          <div class="navigator-customize-sheet__title">
            {{ t('settings.navigator.editSheetTitle') }}
          </div>
          <div class="navigator-customize-sheet__hint">
            {{ t('settings.navigator.editSheetHint') }}
          </div>
        </div>
        <Button
          size="sm"
          @click="navCustomizeStore.exitEditMode()"
        >
          <CheckIcon :size="14" />
          {{ t('settings.navigator.editDone') }}
        </Button>
      </div>

      <div class="navigator-customize-sheet__body">
        <Container
          class="navigator-customize-sheet__pool"
          orientation="horizontal"
          :group-name="NAV_CUSTOMIZE_DRAG_GROUP"
          :get-child-payload="poolPayload"
          drag-class="navigator-customize-sheet__tile--dragging"
          @drop="onPoolDrop"
        >
          <Draggable
            v-for="(item, index) in poolItems"
            :key="item.type + ':' + item.id + ':' + index"
          >
            <div class="navigator-customize-sheet__tile">
              <component
                :is="poolIcon(item)"
                :size="18"
              />
              <span class="navigator-customize-sheet__tile-label">{{ poolLabel(item) }}</span>
            </div>
          </Draggable>
        </Container>

        <Container
          class="navigator-customize-sheet__separator-source"
          orientation="horizontal"
          :group-name="NAV_CUSTOMIZE_DRAG_GROUP"
          behaviour="copy"
          :get-child-payload="separatorPayload"
        >
          <Draggable>
            <div
              class="navigator-customize-sheet__tile navigator-customize-sheet__tile--separator"
            >
              <SeparatorVerticalIcon :size="18" />
              <span class="navigator-customize-sheet__tile-label">{{ t('settings.navigator.toolbarSeparator') }}</span>
            </div>
          </Draggable>
        </Container>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.navigator-customize-sheet {
  z-index: 20;
  display: flex;
  flex-direction: column;
  margin: 0 6px 6px;
  padding: 12px;
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-2));
  gap: 10px;
}

.navigator-customize-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.navigator-customize-sheet__title {
  font-size: 13px;
  font-weight: 600;
}

.navigator-customize-sheet__hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.navigator-customize-sheet__body {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
}

.navigator-customize-sheet__pool {
  display: flex;
  min-height: 64px;
  min-width: 120px;
  flex: 1;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
}

.navigator-customize-sheet__separator-source {
  display: flex;
  flex-shrink: 0;
}

.navigator-customize-sheet__tile {
  display: flex;
  width: 76px;
  height: 60px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: grab;
  gap: 6px;
  text-align: center;
}

.navigator-customize-sheet__tile--separator {
  border-style: dashed;
  color: hsl(var(--muted-foreground));
}

.navigator-customize-sheet__tile-label {
  width: 100%;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navigator-customize-sheet__tile--dragging {
  opacity: 0.9;
}

.navigator-customize-sheet-enter-active,
.navigator-customize-sheet-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.navigator-customize-sheet-enter-from,
.navigator-customize-sheet-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
