<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  BlocksIcon,
  FolderIcon,
  FolderPlusIcon,
  HardDriveIcon,
  NetworkIcon,
  UsbIcon,
} from '@lucide/vue';
import { Container, Draggable, type DropResult } from 'vue3-smooth-dnd';
import { useNavCustomizeStore, NAV_CUSTOMIZE_DRAG_GROUP } from '@/stores/runtime/nav-customize';
import type { SidebarItem, SidebarRouteId } from '@/types/user-settings';
import { useAppStore } from '@/stores/runtime/app';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import {
  BUILTIN_NAVIGATION_PAGE_SHORTCUTS,
  useShortcutsStore,
} from '@/stores/runtime/shortcuts';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useDrives } from '@/modules/home/composables';
import { DriveCard } from '@/modules/home/components';
import { useFileBrowserDragSession } from '@/modules/navigator/components/file-browser/composables/use-file-browser-drag-session';
import { getLucideIcon } from '@/utils/lucide-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { CONTEXT_MENU_OPEN_COUNT_KEY } from '@/components/dir-entry-interactive';
import { formatKeybindingKeys } from '@/modules/extensions/api';
import QuickAccessPanel from './components/quick-access-panel.vue';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';

const { t } = useI18n();
const router = useRouter();
const appStore = useAppStore();
const extensionsStore = useExtensionsStore();
const shortcutsStore = useShortcutsStore();
const userSettingsStore = useUserSettingsStore();
const workspacesStore = useWorkspacesStore();
const { drives } = useDrives();

const quickAccessOnHover = computed(() => userSettingsStore.userSettings.quickAccessOnHover);

// Render the page buttons in the user-configured order, hiding any toggled off in
// settings. Pages missing from the saved config (e.g. newly added in an update)
// are appended in their original order so nothing silently disappears.
const orderedPages = computed(() => {
  const configItems = userSettingsStore.userSettings.navigator.sidebar?.items ?? [];
  const pagesByName = new Map(appStore.pages.map(page => [String(page.name), page]));
  const result: typeof appStore.pages = [];
  const seen = new Set<string>();

  for (const configItem of configItems) {
    const page = pagesByName.get(configItem.id);

    if (page && configItem.visible) {
      result.push(page);
    }

    seen.add(configItem.id);
  }

  for (const page of appStore.pages) {
    if (!seen.has(String(page.name))) {
      result.push(page);
    }
  }

  return result;
});

const navCustomizeStore = useNavCustomizeStore();
const editing = computed(() => navCustomizeStore.isEditMode);

// In edit mode the configured (visible) builtin pages are rendered as a draggable
// list. Each entry resolves to the real page object so the real icon is shown.
const editableSidebarPages = computed(() => {
  const configItems = userSettingsStore.userSettings.navigator.sidebar?.items ?? [];
  const pagesByName = new Map(appStore.pages.map(page => [String(page.name), page]));
  const result: {
    id: SidebarRouteId;
    title: string;
    icon: typeof appStore.pages[number]['icon'];
  }[] = [];

  for (const configItem of configItems) {
    if (!configItem.visible) {
      continue;
    }

    const page = pagesByName.get(configItem.id);

    if (page) {
      result.push({
        id: configItem.id,
        title: page.title,
        icon: page.icon,
      });
    }
  }

  return result;
});

function getSidebarPayload(index: number): { sidebarId: SidebarRouteId } {
  return { sidebarId: editableSidebarPages.value[index].id };
}

// Reconcile a drop against the visible-id list, then rebuild the full
// {id, visible}[] config (visible in new order, then the rest hidden).
function onSidebarDrop(dropResult: DropResult) {
  const { removedIndex, addedIndex, payload } = dropResult;

  if (removedIndex === null && addedIndex === null) {
    return;
  }

  const visibleIds = editableSidebarPages.value.map(entry => entry.id);
  let movedId: SidebarRouteId | undefined;

  if (removedIndex !== null) {
    movedId = visibleIds.splice(removedIndex, 1)[0];
  }

  if (addedIndex !== null) {
    const incoming = (payload as { sidebarId?: SidebarRouteId } | undefined)?.sidebarId ?? movedId;

    // Ignore foreign payloads (e.g. a toolbar action from the shared drag group).
    if (!incoming) {
      return;
    }

    const existingPos = visibleIds.indexOf(incoming);

    if (existingPos !== -1) {
      visibleIds.splice(existingPos, 1);
    }

    visibleIds.splice(addedIndex, 0, incoming);
  }

  const configItems = userSettingsStore.userSettings.navigator.sidebar?.items ?? [];
  const items: SidebarItem[] = visibleIds.map(id => ({
    id,
    visible: true,
  }));

  for (const configItem of configItems) {
    if (!visibleIds.includes(configItem.id)) {
      items.push({
        id: configItem.id,
        visible: false,
      });
    }
  }

  persistSidebar({ items });
}

// Persist sidebar settings while preserving fields not being changed.
function persistSidebar(partial: {
  items?: SidebarItem[];
  autoShowDrives?: boolean;
  pinnedPaths?: string[];
}) {
  const sidebar = userSettingsStore.userSettings.navigator.sidebar;
  userSettingsStore.set('navigator.sidebar', {
    items: partial.items ?? sidebar.items.map(item => ({ ...item })),
    autoShowDrives: partial.autoShowDrives ?? sidebar.autoShowDrives ?? true,
    pinnedPaths: partial.pinnedPaths ?? [...(sidebar.pinnedPaths ?? [])],
  });
}

const pinnedPaths = computed(() => userSettingsStore.userSettings.navigator.sidebar?.pinnedPaths ?? []);
const autoShowDrives = computed(() => userSettingsStore.userSettings.navigator.sidebar?.autoShowDrives ?? true);

const driveByPath = computed(() => new Map(drives.value.map(drive => [drive.path, drive])));

// A bottom-area entry is either a discovered drive or a pinned folder shortcut.
// Folder shortcuts are pinned paths that don't currently resolve to a drive (an
// arbitrary directory the user dropped, or a drive that is temporarily disconnected).
type SidebarDriveEntry = typeof drives.value[number];
type SidebarBottomItem
  = | {
    kind: 'drive';
    path: string;
    drive: SidebarDriveEntry;
  }
  | {
    kind: 'folder';
    path: string;
    name: string;
  };

// Derive a short display name (basename) from a folder path, tolerating either slash.
function shortcutName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function resolvePinnedItem(path: string): SidebarBottomItem {
  const drive = driveByPath.value.get(path);
  return drive
    ? {
        kind: 'drive',
        path,
        drive,
      }
    : {
        kind: 'folder',
        path,
        name: shortcutName(path),
      };
}

// Normal mode: pinned items (drives or folder shortcuts, in saved order) first, then
// auto-discovered drives (only when auto-show is on) that aren't already pinned.
const displayedDrives = computed<SidebarBottomItem[]>(() => {
  const pinnedSet = new Set(pinnedPaths.value);
  const pinned = pinnedPaths.value.map(resolvePinnedItem);

  const autoDrives: SidebarBottomItem[] = autoShowDrives.value
    ? drives.value
        .filter(drive => !pinnedSet.has(drive.path))
        .map(drive => ({
          kind: 'drive',
          path: drive.path,
          drive,
        }))
    : [];

  return [...pinned, ...autoDrives];
});

// Edit mode: pinned items first (in saved order), then every other discovered drive,
// each tagged with its pinned state so the UI can dim unpinned drives and offer
// click-to-pin (and click-to-remove for folder shortcuts).
const editDrives = computed<(SidebarBottomItem & { pinned: boolean })[]>(() => {
  const pinnedSet = new Set(pinnedPaths.value);
  const pinned = pinnedPaths.value.map(path => ({
    ...resolvePinnedItem(path),
    pinned: true,
  }));
  const rest = drives.value
    .filter(drive => !pinnedSet.has(drive.path))
    .map(drive => ({
      kind: 'drive' as const,
      path: drive.path,
      drive,
      pinned: false,
    }));

  return [...pinned, ...rest];
});

function getEditDrivePayload(index: number): { drivePath: string } {
  return { drivePath: editDrives.value[index].path };
}

// Reorder of the edit list: the resulting full order becomes the pinned order, so the
// user's arrangement is what gets saved. The auto-show toggle controls whether
// non-pinned discovered drives also appear in normal mode.
function onDrivesDrop(dropResult: DropResult) {
  const { removedIndex, addedIndex } = dropResult;

  if (removedIndex === null && addedIndex === null) {
    return;
  }

  const order = editDrives.value.map(entry => entry.path);
  let moved: string | undefined;

  if (removedIndex !== null) {
    moved = order.splice(removedIndex, 1)[0];
  }

  if (addedIndex !== null && moved !== undefined) {
    order.splice(addedIndex, 0, moved);
  }

  persistSidebar({ pinnedPaths: order });
}

function toggleDrivePin(path: string) {
  if (pinnedPaths.value.includes(path)) {
    persistSidebar({ pinnedPaths: pinnedPaths.value.filter(pinned => pinned !== path) });
  }
  else {
    persistSidebar({ pinnedPaths: [...pinnedPaths.value, path] });
  }
}

// Accept folders dragged out of the file browser (the custom mouse-driven drag session)
// and pin them to the bottom area as shortcuts. The drop zone is live in both normal and
// edit mode so a folder can be pinned at any time, not only while customizing.
const { dragState: fileDragState, cancelDrag: cancelFileDrag } = useFileBrowserDragSession();

const isFileDragActive = computed(() =>
  fileDragState.value.isActive
  && fileDragState.value.items.some(item => item.is_dir),
);

const isShortcutDropHover = ref(false);

function handleShortcutDropEnter() {
  if (isFileDragActive.value) {
    isShortcutDropHover.value = true;
  }
}

function handleShortcutDropLeave() {
  isShortcutDropHover.value = false;
}

function handleShortcutDrop() {
  isShortcutDropHover.value = false;

  if (!isFileDragActive.value) {
    return;
  }

  const additions = fileDragState.value.items
    .filter(item => item.is_dir)
    .map(item => item.path)
    .filter(path => !pinnedPaths.value.includes(path));

  // Consume the drop so the shared drag session doesn't also treat it as a move/copy.
  cancelFileDrag();

  if (additions.length > 0) {
    persistSidebar({ pinnedPaths: [...pinnedPaths.value, ...additions] });
  }
}

const quickAccessContextMenuOpenCount = ref(0);
provide(CONTEXT_MENU_OPEN_COUNT_KEY, quickAccessContextMenuOpenCount);

const quickAccessHoverOpen = ref(false);
const quickAccessTooltipOpen = computed(() =>
  quickAccessHoverOpen.value || quickAccessContextMenuOpenCount.value > 0,
);

function handleQuickAccessTooltipOpenChange(value: boolean) {
  quickAccessHoverOpen.value = value;
}

function isDashboardPage(item: { name?: unknown }) {
  return item.name === 'dashboard';
}

const sortedExtensionPages = computed(() => {
  return [...extensionsStore.sidebarPages].sort((a, b) => {
    const orderA = a.page.order ?? 0;
    const orderB = b.page.order ?? 0;
    return orderA - orderB;
  });
});

function isExtensionPageActive(pageId: string) {
  return router.currentRoute.value.name === 'extension-page'
    && router.currentRoute.value.params.fullPageId === pageId;
}

function openExtensionPage(pageId: string) {
  router.push({
    name: 'extension-page',
    params: { fullPageId: pageId },
  });
}

function getPageShortcutLabel(routeName: unknown): string {
  const shortcut = BUILTIN_NAVIGATION_PAGE_SHORTCUTS.find(
    item => item.routeName === routeName,
  );

  return shortcut ? shortcutsStore.getShortcutLabel(shortcut.id) : '';
}

function getExtensionPageShortcutLabel(pageId: string): string {
  const keybinding = extensionsStore.getSidebarPageKeybinding(pageId);
  return keybinding?.keys?.key ? formatKeybindingKeys(keybinding.keys) : '';
}

async function openDrive(path: string) {
  if (router.currentRoute.value.name === 'navigator') {
    await workspacesStore.openPathInCurrentTab(path);
    return;
  }

  await workspacesStore.openNewTabGroup(path);
  await router.push({ name: 'navigator' });
}

function getDriveIcon(drive: {
  drive_type: string;
  is_removable: boolean;
}) {
  if (drive.drive_type === 'Network') {
    return NetworkIcon;
  }

  return drive.is_removable ? UsbIcon : HardDriveIcon;
}
</script>

<template>
  <div
    class="nav-sidebar"
    data-e2e-root="nav-sidebar"
  >
    <div class="nav-sidebar-header">
      <div class="nav-sidebar-header-logo">
        <img
          src="@/assets/icons/logo-32x32.png"
          width="20"
          height="20"
        >
      </div>
    </div>

    <div class="nav-sidebar-items">
      <Container
        v-if="editing"
        class="nav-sidebar-edit-list"
        orientation="vertical"
        lock-axis="y"
        :group-name="NAV_CUSTOMIZE_DRAG_GROUP"
        :get-child-payload="getSidebarPayload"
        drag-class="nav-sidebar__chip--dragging"
        @drop="onSidebarDrop"
      >
        <Draggable
          v-for="(entry, entryIndex) in editableSidebarPages"
          :key="'edit-' + entry.id + '-' + entryIndex"
        >
          <button
            type="button"
            class="nav-sidebar-item nav-sidebar-edit-item"
            :title="entry.title"
          >
            <component
              :is="entry.icon"
              :size="18"
              class="nav-sidebar-item-icon"
            />
          </button>
        </Draggable>
      </Container>

      <template v-if="!editing">
        <template
          v-for="(item, index) in orderedPages"
          :key="index"
        >
          <Tooltip
            v-if="isDashboardPage(item) && quickAccessOnHover"
            :open="quickAccessTooltipOpen"
            @update:open="handleQuickAccessTooltipOpenChange"
          >
            <TooltipTrigger as-child>
              <Button
                class="nav-sidebar-item"
                size="icon"
                :value="item.name"
                :is-active="item.name === router.currentRoute.value.name"
                @click="router.push({ name: item.name })"
              >
                <component
                  :is="item.icon"
                  :size="18"
                  class="nav-sidebar-item-icon"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="start"
              :side-offset="12"
              :collision-padding="6"
              class="nav-sidebar__quick-access-tooltip"
            >
              <div class="nav-sidebar__quick-access-title">
                <div class="nav-sidebar__tooltip-row">
                  <span>{{ item.title }}</span>
                  <ContextMenuShortcut v-if="getPageShortcutLabel(item.name)">
                    {{ getPageShortcutLabel(item.name) }}
                  </ContextMenuShortcut>
                </div>
              </div>
              <QuickAccessPanel />
            </TooltipContent>
          </Tooltip>
          <Tooltip
            v-else
          >
            <TooltipTrigger as-child>
              <Button
                class="nav-sidebar-item"
                size="icon"
                :value="item.name"
                :is-active="item.name === router.currentRoute.value.name"
                @click="router.push({ name: item.name })"
              >
                <component
                  :is="item.icon"
                  :size="18"
                  class="nav-sidebar-item-icon"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              :side-offset="12"
            >
              <div class="nav-sidebar__tooltip-row">
                <span>{{ item.title }}</span>
                <ContextMenuShortcut v-if="getPageShortcutLabel(item.name)">
                  {{ getPageShortcutLabel(item.name) }}
                </ContextMenuShortcut>
              </div>
            </TooltipContent>
          </Tooltip>
        </template>
      </template>

      <Tooltip
        v-for="registration in sortedExtensionPages"
        :key="registration.page.id"
      >
        <TooltipTrigger as-child>
          <Button
            class="nav-sidebar-item"
            size="icon"
            :is-active="isExtensionPageActive(registration.page.id)"
            @click="openExtensionPage(registration.page.id)"
          >
            <component
              :is="getLucideIcon(registration.page.icon) ?? BlocksIcon"
              :size="18"
              class="nav-sidebar-item-icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          :side-offset="12"
        >
          <div class="nav-sidebar__tooltip-row">
            <span>{{ registration.page.title }}</span>
            <ContextMenuShortcut v-if="getExtensionPageShortcutLabel(registration.page.id)">
              {{ getExtensionPageShortcutLabel(registration.page.id) }}
            </ContextMenuShortcut>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>

    <!-- Drop zone: fills the space above the drives so a folder dragged out of the file
         browser can be dropped anywhere in the lower sidebar to pin it as a shortcut. -->
    <div
      class="nav-sidebar-drop-zone"
      :class="{
        'nav-sidebar-drop-zone--active': isFileDragActive,
        'nav-sidebar-drop-zone--over': isShortcutDropHover,
      }"
      @mouseenter="handleShortcutDropEnter"
      @mouseleave="handleShortcutDropLeave"
      @mouseup="handleShortcutDrop"
    >
      <div class="nav-sidebar-spacer">
        <div
          v-if="isFileDragActive"
          class="nav-sidebar-drop-hint"
          :title="t('nav.dropToPin')"
        >
          <FolderPlusIcon :size="16" />
        </div>
      </div>

      <!-- Edit mode: every discovered drive plus pinned folder shortcuts, draggable to
           reorder; click toggles pin / removes a shortcut. Unpinned drives are dimmed. -->
      <Container
        v-if="editing"
        class="nav-sidebar-drives nav-sidebar-drives--editing"
        orientation="vertical"
        lock-axis="y"
        :get-child-payload="getEditDrivePayload"
        drag-class="nav-sidebar__chip--dragging"
        @drop="onDrivesDrop"
      >
        <Draggable
          v-for="(entry, entryIndex) in editDrives"
          :key="'edit-drive-' + entry.path + '-' + entryIndex"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="nav-sidebar-drive nav-sidebar-edit-item"
                :class="{ 'nav-sidebar-drive--unpinned': !entry.pinned }"
                @click="toggleDrivePin(entry.path)"
              >
                <UbuntuWslIcon
                  v-if="entry.kind === 'drive' && entry.drive.drive_type === 'WSL'"
                  :size="16"
                  class="nav-sidebar-drive-icon"
                />
                <component
                  :is="getDriveIcon(entry.drive)"
                  v-else-if="entry.kind === 'drive'"
                  :size="16"
                  class="nav-sidebar-drive-icon"
                />
                <FolderIcon
                  v-else
                  :size="16"
                  class="nav-sidebar-drive-icon"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              :side-offset="12"
            >
              <template v-if="entry.kind === 'folder'">
                {{ entry.name }} — {{ t('nav.removeShortcut') }}
              </template>
              <template v-else>
                {{ entry.pinned ? t('nav.unpinDrive') : t('nav.pinDrive') }}
              </template>
            </TooltipContent>
          </Tooltip>
        </Draggable>
      </Container>

      <div
        v-else
        class="nav-sidebar-drives"
      >
        <Tooltip
          v-for="item in displayedDrives"
          :key="item.path"
        >
          <TooltipTrigger as-child>
            <Button
              class="nav-sidebar-drive"
              size="icon"
              @click="openDrive(item.path)"
            >
              <UbuntuWslIcon
                v-if="item.kind === 'drive' && item.drive.drive_type === 'WSL'"
                :size="16"
                class="nav-sidebar-drive-icon"
              />
              <component
                :is="getDriveIcon(item.drive)"
                v-else-if="item.kind === 'drive'"
                :size="16"
                class="nav-sidebar-drive-icon"
              />
              <FolderIcon
                v-else
                :size="16"
                class="nav-sidebar-drive-icon"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            :side-offset="12"
            :collision-padding="6"
            :class="item.kind === 'drive' ? 'nav-sidebar-drive-tooltip' : undefined"
          >
            <DriveCard
              v-if="item.kind === 'drive'"
              :drive="item.drive"
            />
            <span v-else>{{ item.name }}</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nav-sidebar {
  z-index: 10;
  display: flex;
  width: var(--nav-sidebar-width);
  height: calc(100vh - 12px);
  flex-direction: column;
  border-radius: var(--radius-sm);
  margin: 6px;
  background-color: hsl(var(--background-2));
}

.nav-sidebar-header {
  display: flex;
  height: var(--window-toolbar-height);
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  background-color: hsl(var(--background-2));
}

.nav-sidebar-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  gap: 12px;
}

.nav-sidebar-edit-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  border: 1px dashed hsl(var(--primary) / 50%);
  border-radius: var(--radius-sm);
  gap: 12px;
}

.nav-sidebar-edit-item {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background-color: transparent;
  cursor: grab;
}

.nav-sidebar-edit-item:hover {
  background-color: hsl(var(--foreground) / 5%);
}

.nav-sidebar__chip--dragging {
  opacity: 0.9;
}

.nav-sidebar-drives--editing {
  border: 1px dashed hsl(var(--primary) / 50%);
  border-radius: var(--radius-sm);
}

.nav-sidebar-drive--unpinned {
  opacity: 0.4;
}

.nav-sidebar-drive--unpinned:hover {
  opacity: 0.7;
}

.nav-sidebar-drop-zone {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  border-radius: var(--radius-sm);
  margin: 0 4px;
  transition: background-color 120ms ease, box-shadow 120ms ease;
}

/* While a folder is being dragged, advertise the whole lower area as a drop target. */
.nav-sidebar-drop-zone--active {
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 35%);
}

.nav-sidebar-drop-zone--active.nav-sidebar-drop-zone--over {
  background-color: hsl(var(--primary) / 10%);
  box-shadow: inset 0 0 0 2px hsl(var(--primary) / 70%);
}

.nav-sidebar-spacer {
  display: flex;
  flex: 1;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
}

.nav-sidebar-drop-hint {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px dashed hsl(var(--primary) / 60%);
  border-radius: var(--radius-sm);
  color: hsl(var(--primary));
}

.nav-sidebar-drives {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  padding: 4px;
  padding-bottom: 12px;
  gap: 8px;
}

.nav-sidebar-item {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: transparent;
  cursor: pointer;
}

.nav-sidebar-item:hover {
  background-color: hsl(var(--foreground) / 3%);
}

.nav-sidebar-item[is-active="true"] {
  background-color: hsl(var(--foreground) / 5%);
}

.nav-sidebar-item-icon {
  stroke: hsl(var(--icon));
}

.nav-sidebar-item[is-active="true"] .nav-sidebar-item-icon {
  stroke: hsl(var(--primary));
}

.nav-sidebar-drive {
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: transparent;
  cursor: pointer;
}

.nav-sidebar-drive:hover {
  background-color: hsl(var(--foreground) / 3%);
}

.nav-sidebar-drive-icon {
  color: hsl(var(--muted-foreground));
  stroke: hsl(var(--muted-foreground));
}

.nav-sidebar-drive:hover .nav-sidebar-drive-icon {
  color: hsl(var(--foreground));
  stroke: hsl(var(--foreground));
}

</style>

<style>
.nav-sidebar__quick-access-tooltip {
  padding: 0;
  border: 1px solid hsl(var(--border) / 50%);
  margin-top: 0;
}

.nav-sidebar__quick-access-title {
  padding: 8px 10px;
  border-bottom: 1px solid hsl(var(--border) / 50%);
}

.nav-sidebar-drive-tooltip {
  padding: 0;
  border: none;
  background: transparent;
}

.nav-sidebar__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.nav-sidebar-drive-tooltip .drive-card {
  min-width: 260px;
}
</style>
