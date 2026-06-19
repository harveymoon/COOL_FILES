<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Container, Draggable, type DropResult } from 'vue3-smooth-dnd';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useNavCustomizeStore, NAV_CUSTOMIZE_DRAG_GROUP } from '@/stores/runtime/nav-customize';
import type { ToolbarActionId, ToolbarWidgetId, ToolbarItem } from '@/types/user-settings';
import ColumnsLayoutIcon from './columns-layout-icon.vue';
import {
  getToolbarActionDefinition,
  TOOLBAR_ACTION_SHORTCUT_MAP,
  TOOLBAR_HIDDEN_FILES_ACTIVE_ICON,
} from './toolbar-actions';
import { getToolbarWidgetDefinition } from './toolbar-widgets';

type LayoutType = 'list' | 'grid' | 'columns' | 'tree';

const props = defineProps<{
  isSplitView: boolean;
  showInfoPanel: boolean;
  isGlobalSearchOpen: boolean;
}>();

const emit = defineEmits<{
  'toggle-split-view': [];
  'toggle-info-panel': [];
  'navigate-home': [];
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const shortcutsStore = useShortcutsStore();
const navCustomizeStore = useNavCustomizeStore();

const editing = computed(() => navCustomizeStore.isEditMode);

const toolbarItems = computed<ToolbarItem[]>(
  () => userSettingsStore.userSettings.navigator.toolbar?.items ?? [],
);

// In edit mode the toolbar becomes a smooth-dnd container. Returns the dragged
// item so other containers (sidebar pool) know what was picked up.
function toolbarPayload(index: number): ToolbarItem {
  return toolbarItems.value[index];
}

// Canonical smooth-dnd reconciliation (matches tab-draggable / settings editor):
// remove the item that left, then insert the incoming payload at the drop index.
function onToolbarDrop(dropResult: DropResult) {
  const { removedIndex, addedIndex, payload } = dropResult;

  if (removedIndex === null && addedIndex === null) {
    return;
  }

  const next = [...toolbarItems.value];
  let moved = payload as ToolbarItem | undefined;

  if (removedIndex !== null) {
    moved = next.splice(removedIndex, 1)[0];
  }

  // Only insert genuine toolbar items. A foreign payload (e.g. a sidebar page
  // dragged over from the shared drag group) is ignored on add, so it can't
  // corrupt the toolbar list; the removal branch above still applies.
  const isToolbarItem = !!moved && (moved.kind === 'action' || moved.kind === 'separator');

  if (addedIndex !== null && moved && isToolbarItem) {
    next.splice(addedIndex, 0, moved);
  }

  userSettingsStore.set('navigator.toolbar', { items: next });
}

const currentLayout = computed(() => {
  const layoutName = userSettingsStore.userSettings.navigator.layout.type.name;
  return layoutName === 'compact-list' ? 'list' : layoutName;
});

const showHiddenFiles = computed(() => userSettingsStore.userSettings.navigator.showHiddenFiles);

const LAYOUT_BY_ACTION: Partial<Record<ToolbarActionId, LayoutType>> = {
  layoutList: 'list',
  layoutGrid: 'grid',
  layoutColumns: 'columns',
  layoutTree: 'tree',
};

async function setLayout(layoutName: LayoutType) {
  const layoutTitleByName = {
    list: 'listLayout',
    grid: 'gridLayout',
    columns: 'columnsLayout',
    tree: 'treeLayout',
  } as const;
  await userSettingsStore.set('navigator.layout.type', {
    title: layoutTitleByName[layoutName],
    name: layoutName,
  });
}

function handleToggleHiddenFiles() {
  userSettingsStore.set('navigator.showHiddenFiles', !showHiddenFiles.value);
}

function runAction(id: ToolbarActionId) {
  if (editing.value || isActionDisabled(id)) {
    return;
  }

  const layout = LAYOUT_BY_ACTION[id];

  if (layout) {
    setLayout(layout);
    return;
  }

  if (id === 'splitView') {
    emit('toggle-split-view');
    return;
  }

  if (id === 'infoPanel') {
    emit('toggle-info-panel');
    return;
  }

  if (id === 'toggleHiddenFiles') {
    handleToggleHiddenFiles();
    return;
  }

  if (id === 'home') {
    emit('navigate-home');
    return;
  }

  const shortcutId = TOOLBAR_ACTION_SHORTCUT_MAP[id];

  if (shortcutId) {
    shortcutsStore.executeShortcut(shortcutId as never);
  }
}

function isActionActive(id: ToolbarActionId): boolean {
  const layout = LAYOUT_BY_ACTION[id];

  if (layout) {
    return currentLayout.value === layout;
  }

  if (id === 'splitView') {
    return props.isSplitView;
  }

  if (id === 'infoPanel') {
    return props.showInfoPanel;
  }

  if (id === 'toggleHiddenFiles') {
    return showHiddenFiles.value;
  }

  return false;
}

function isActionDisabled(id: ToolbarActionId): boolean {
  if (id === 'splitView') {
    return props.isGlobalSearchOpen;
  }

  return false;
}

function actionIcon(id: ToolbarActionId): Component | undefined {
  if (id === 'layoutColumns') {
    return ColumnsLayoutIcon;
  }

  if (id === 'toggleHiddenFiles' && showHiddenFiles.value) {
    return TOOLBAR_HIDDEN_FILES_ACTIVE_ICON;
  }

  return getToolbarActionDefinition(id)?.icon;
}

function actionLabel(id: ToolbarActionId): string {
  const definition = getToolbarActionDefinition(id);
  return definition ? t(definition.labelKey) : id;
}

function widgetComponent(id: ToolbarWidgetId): Component | undefined {
  return getToolbarWidgetDefinition(id)?.component;
}

function widgetIcon(id: ToolbarWidgetId): Component | undefined {
  return getToolbarWidgetDefinition(id)?.icon;
}

function widgetLabel(id: ToolbarWidgetId): string {
  const definition = getToolbarWidgetDefinition(id);
  return definition ? t(definition.labelKey) : id;
}
</script>

<template>
  <Teleport to=".window-toolbar-secondary-teleport-target">
    <!-- Normal state: plain clickable buttons. -->
    <div
      v-if="!editing"
      class="navigator-toolbar-actions animate-fade-in"
    >
      <template
        v-for="(item, index) in toolbarItems"
        :key="index"
      >
        <div
          v-if="item.kind === 'separator'"
          class="navigator-toolbar-actions__divider"
        />
        <component
          :is="widgetComponent(item.id)"
          v-else-if="item.kind === 'widget' && widgetComponent(item.id)"
        />
        <Tooltip v-else-if="item.kind === 'action' && getToolbarActionDefinition(item.id)">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :class="{ 'navigator-toolbar-actions__button--active': isActionActive(item.id) }"
              :disabled="isActionDisabled(item.id)"
              @click="runAction(item.id)"
            >
              <component
                :is="actionIcon(item.id)"
                :size="16"
                class="navigator-toolbar-actions__icon"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ actionLabel(item.id) }}</TooltipContent>
        </Tooltip>
      </template>
    </div>

    <!-- Edit state: same buttons, but draggable via smooth-dnd. Drag out to the
         customize sheet's pool to remove; drag from pool to add. -->
    <Container
      v-else
      class="navigator-toolbar-actions navigator-toolbar-actions--editing animate-fade-in"
      orientation="horizontal"
      :group-name="NAV_CUSTOMIZE_DRAG_GROUP"
      :get-child-payload="toolbarPayload"
      drag-class="navigator-toolbar-actions__chip--dragging"
      @drop="onToolbarDrop"
    >
      <Draggable
        v-for="(item, index) in toolbarItems"
        :key="'edit-' + index"
      >
        <div
          v-if="item.kind === 'separator'"
          class="navigator-toolbar-actions__divider navigator-toolbar-actions__divider--editing"
        />
        <button
          v-else-if="item.kind === 'widget' && widgetComponent(item.id)"
          type="button"
          class="navigator-toolbar-actions__edit-btn"
          :title="widgetLabel(item.id)"
        >
          <component
            :is="widgetIcon(item.id)"
            :size="16"
            class="navigator-toolbar-actions__icon"
          />
        </button>
        <button
          v-else-if="item.kind === 'action' && getToolbarActionDefinition(item.id)"
          type="button"
          class="navigator-toolbar-actions__edit-btn"
          :title="actionLabel(item.id)"
        >
          <component
            :is="actionIcon(item.id)"
            :size="16"
            class="navigator-toolbar-actions__icon"
          />
        </button>
      </Draggable>
    </Container>
  </Teleport>
</template>

<style>
.navigator-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.navigator-toolbar-actions .cool-files-ui-button {
  width: 28px;
  height: 28px;
}

.navigator-toolbar-actions__icon {
  stroke: hsl(var(--foreground) / 50%);
}

.navigator-toolbar-actions__button--active {
  background-color: hsl(var(--secondary));
}

.navigator-toolbar-actions__button--active .navigator-toolbar-actions__icon {
  stroke: hsl(var(--primary));
}

.navigator-toolbar-actions__layout-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.navigator-toolbar-actions__divider {
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background-color: hsl(var(--border));
}

.navigator-toolbar-actions__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* Edit mode: draggable buttons mirror the normal ghost-button look. */
.navigator-toolbar-actions--editing {
  padding: 2px 6px;
  border: 1px dashed hsl(var(--primary) / 50%);
  border-radius: var(--radius-sm);
}

.navigator-toolbar-actions__edit-btn {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: grab;
}

.navigator-toolbar-actions__edit-btn:hover {
  background-color: hsl(var(--secondary));
}

.navigator-toolbar-actions__divider--editing {
  cursor: grab;
}

.navigator-toolbar-actions__chip--dragging {
  opacity: 0.9;
}
</style>
