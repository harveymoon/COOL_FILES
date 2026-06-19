// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Home-page data layer. Since the full merge there is a single model: an ordered
// list of `home.groups`, each holding directory tiles. The former "User
// Directories" section is just the default group, seeded once from the OS user
// folders (and any legacy `userDirectories` customizations) by `ensureInitialized`.
// The runtime edit flag and shared drag groups live in `@/stores/runtime/home-customize`.

import { computed } from 'vue';
import {
  audioDir,
  desktopDir,
  documentDir,
  downloadDir,
  homeDir,
  pictureDir,
  videoDir,
} from '@tauri-apps/api/path';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { HomeGroup, HomeGroupItem, UserDirectoriesCustomizations } from '@/types/user-settings';
import normalizePath from '@/utils/normalize-path';
import uniqueId from '@/utils/unique-id';

// Payload carried by smooth-dnd while dragging a directory tile in edit mode.
// Every tile now originates from a group, so a single shape suffices.
export type HomeDirDragPayload = {
  source: 'group';
  groupId: string;
  item: HomeGroupItem;
};

// The default group's id is stable so it can be recognised across sessions.
export const DEFAULT_HOME_GROUP_ID = 'user-directories';
export const DEFAULT_HOME_GROUP_TITLE_KEY = 'userDirectories';

// Built-in OS user folders used to seed the default group on first run.
interface BuiltInDirectoryDefinition {
  id: string;
  titleKey: string;
  iconName: string;
  pathFn: () => Promise<string>;
}

const BUILTIN_DIRECTORY_DEFINITIONS: BuiltInDirectoryDefinition[] = [
  {
    id: 'home',
    titleKey: 'userDirs.home',
    iconName: 'HomeIcon',
    pathFn: homeDir,
  },
  {
    id: 'desktop',
    titleKey: 'userDirs.desktop',
    iconName: 'MonitorIcon',
    pathFn: desktopDir,
  },
  {
    id: 'downloads',
    titleKey: 'userDirs.downloads',
    iconName: 'DownloadIcon',
    pathFn: downloadDir,
  },
  {
    id: 'documents',
    titleKey: 'userDirs.documents',
    iconName: 'FileTextIcon',
    pathFn: documentDir,
  },
  {
    id: 'pictures',
    titleKey: 'userDirs.pictures',
    iconName: 'ImageIcon',
    pathFn: pictureDir,
  },
  {
    id: 'videos',
    titleKey: 'userDirs.videos',
    iconName: 'VideoIcon',
    pathFn: videoDir,
  },
  {
    id: 'music',
    titleKey: 'userDirs.music',
    iconName: 'MusicIcon',
    pathFn: audioDir,
  },
];

const BUILTIN_DIRECTORY_IDS = new Set(BUILTIN_DIRECTORY_DEFINITIONS.map(definition => definition.id));

// Guards the one-time async seed so concurrent callers don't double-seed.
let initializationInFlight: Promise<void> | null = null;

function cloneGroups(groups: HomeGroup[]): HomeGroup[] {
  return groups.map(group => ({
    ...group,
    items: group.items.map(item => ({ ...item })),
  }));
}

// Stable sort that honours an explicit order list while preserving the natural
// order of any keys not present in it (those sort to the end, order kept).
export function applyHomeOrder<T>(items: T[], order: string[], keyOf: (item: T) => string): T[] {
  const indexOf = new Map(order.map((key, index) => [key, index] as const));
  const fallback = Number.MAX_SAFE_INTEGER;

  return [...items].sort((a, b) => {
    const ia = indexOf.get(keyOf(a)) ?? fallback;
    const ib = indexOf.get(keyOf(b)) ?? fallback;
    return ia - ib;
  });
}

export function useHomeCustomize() {
  const userSettingsStore = useUserSettingsStore();

  const groups = computed<HomeGroup[]>(() => userSettingsStore.userSettings.home?.groups ?? []);
  const drivesOrder = computed<string[]>(() => userSettingsStore.userSettings.home?.drivesOrder ?? []);

  async function setGroups(next: HomeGroup[]) {
    await userSettingsStore.set('home.groups', next);
  }

  // Resolve a group's display title: explicit rename wins, else the localized
  // built-in key, else a neutral fallback supplied by the caller.
  function resolveGroupTitle(group: HomeGroup, translate: (key: string) => string, fallback: string): string {
    if (group.title?.trim()) {
      return group.title;
    }

    if (group.titleKey) {
      return translate(group.titleKey);
    }

    return fallback;
  }

  // Build the default group's tiles from the OS user folders plus any legacy
  // `userDirectories` customizations (custom title/path/icon, deletions, and
  // extra "custom:" directories), honouring the legacy display order.
  async function buildDefaultGroupItems(
    customizations: UserDirectoriesCustomizations,
    order: string[],
  ): Promise<HomeGroupItem[]> {
    const items: HomeGroupItem[] = [];

    for (const definition of BUILTIN_DIRECTORY_DEFINITIONS) {
      const customization = customizations[definition.id];

      if (customization?.deleted) {
        continue;
      }

      let defaultPath: string;

      try {
        defaultPath = normalizePath(await definition.pathFn());
      }
      catch {
        continue;
      }

      const customPath = customization?.path ? normalizePath(customization.path) : undefined;

      items.push({
        id: definition.id,
        path: customPath || defaultPath,
        titleKey: definition.titleKey,
        title: customization?.title || undefined,
        icon: customization?.icon || definition.iconName,
      });
    }

    for (const [id, customization] of Object.entries(customizations)) {
      if (BUILTIN_DIRECTORY_IDS.has(id) || customization.deleted) {
        continue;
      }

      const customPath = customization.path ? normalizePath(customization.path) : undefined;

      if (!customPath) {
        continue;
      }

      items.push({
        id,
        path: customPath,
        title: customization.title || undefined,
        icon: customization.icon || undefined,
      });
    }

    return applyHomeOrder(items, order, item => item.id);
  }

  // One-time seed: prepend the default group (built from the legacy model + OS
  // folders) ahead of any pre-existing custom groups, then mark home initialized.
  async function ensureInitialized(): Promise<void> {
    // Components (e.g. the home page) mount while the window is still hidden,
    // concurrently with settings loading. Wait until settings are actually
    // loaded from disk before seeding — otherwise we'd build the default group
    // from empty (not-yet-loaded) legacy `userDirectories` data and then lock
    // that wrong result in via the `home.initialized` flag.
    await userSettingsStore.whenStorageLoaded();

    if (userSettingsStore.userSettings.home?.initialized) {
      return;
    }

    if (initializationInFlight) {
      return initializationInFlight;
    }

    initializationInFlight = (async () => {
      const home = userSettingsStore.userSettings.home;
      const customizations = userSettingsStore.userSettings.userDirectories || {};
      const order = home?.userDirectoriesOrder ?? [];
      const defaultItems = await buildDefaultGroupItems(customizations, order);

      const defaultGroup: HomeGroup = {
        id: DEFAULT_HOME_GROUP_ID,
        titleKey: DEFAULT_HOME_GROUP_TITLE_KEY,
        items: defaultItems,
      };

      const existing = cloneGroups(home?.groups ?? []);

      // Defensive: never prepend a second default group if a prior partial seed
      // already added one (e.g. the groups write landed but the flag write didn't).
      const alreadySeeded = existing.some(group => group.id === DEFAULT_HOME_GROUP_ID);

      if (!alreadySeeded) {
        await setGroups([defaultGroup, ...existing]);
      }

      await userSettingsStore.set('home.initialized', true);
    })();

    try {
      await initializationInFlight;
    }
    finally {
      initializationInFlight = null;
    }
  }

  async function createGroup(title: string): Promise<string> {
    const id = uniqueId();
    const next = cloneGroups(groups.value);
    next.push({
      id,
      title: title.trim() || 'New group',
      items: [],
    });
    await setGroups(next);
    return id;
  }

  async function renameGroup(groupId: string, title: string) {
    const next = cloneGroups(groups.value);
    const group = next.find(candidate => candidate.id === groupId);

    if (!group) {
      return;
    }

    // An empty rename reverts to the default/localized name (clears the override).
    group.title = title.trim() || undefined;
    await setGroups(next);
  }

  async function deleteGroup(groupId: string) {
    const next = cloneGroups(groups.value).filter(group => group.id !== groupId);
    await setGroups(next);
  }

  // Reorder the groups themselves (drag a group header in edit mode).
  async function reorderGroups(removedIndex: number | null, addedIndex: number | null) {
    if (removedIndex === null || addedIndex === null) {
      return;
    }

    const next = cloneGroups(groups.value);
    const [moved] = next.splice(removedIndex, 1);

    if (!moved) {
      return;
    }

    next.splice(addedIndex, 0, moved);
    await setGroups(next);
  }

  function makeGroupItem(input: {
    path: string;
    title?: string;
    icon?: string;
  }): HomeGroupItem {
    return {
      id: uniqueId(),
      path: normalizePath(input.path),
      title: input.title?.trim() || undefined,
      icon: input.icon || undefined,
    };
  }

  async function addItemToGroup(
    groupId: string,
    input: {
      path: string;
      title?: string;
      icon?: string;
    },
    atIndex?: number,
  ) {
    const next = cloneGroups(groups.value);
    const group = next.find(candidate => candidate.id === groupId);

    if (!group) {
      return;
    }

    const item = makeGroupItem(input);
    const insertAt = atIndex === undefined ? group.items.length : Math.max(0, Math.min(atIndex, group.items.length));
    group.items.splice(insertAt, 0, item);
    await setGroups(next);
  }

  // Update an existing tile's title/path/icon in place (per-tile editor).
  async function updateGroupItem(
    groupId: string,
    itemId: string,
    patch: {
      path: string;
      title?: string;
      icon?: string;
    },
  ) {
    const next = cloneGroups(groups.value);
    const group = next.find(candidate => candidate.id === groupId);
    const item = group?.items.find(candidate => candidate.id === itemId);

    if (!item) {
      return;
    }

    item.path = normalizePath(patch.path);
    item.title = patch.title?.trim() || undefined;
    item.icon = patch.icon || undefined;
    await setGroups(next);
  }

  async function removeItemFromGroup(groupId: string, itemId: string) {
    const next = cloneGroups(groups.value);
    const group = next.find(candidate => candidate.id === groupId);

    if (!group) {
      return;
    }

    group.items = group.items.filter(item => item.id !== itemId);
    await setGroups(next);
  }

  // Apply a smooth-dnd drop to a single group's items list. Handles reorder
  // (removed && added), removal (removed only), and insertion from another
  // container (added only). Cross-group items are normalized to a fresh item.
  async function applyGroupDrop(
    groupId: string,
    dropResult: {
      removedIndex: number | null;
      addedIndex: number | null;
      payload?: unknown;
    },
  ) {
    const { removedIndex, addedIndex } = dropResult;

    if (removedIndex === null && addedIndex === null) {
      return;
    }

    const next = cloneGroups(groups.value);
    const group = next.find(candidate => candidate.id === groupId);

    if (!group) {
      return;
    }

    let moved: HomeGroupItem | undefined;

    if (removedIndex !== null) {
      moved = group.items.splice(removedIndex, 1)[0];
    }

    if (addedIndex !== null) {
      // Reorder within the same group reuses the removed item; an incoming drag
      // from another container provides its payload instead.
      const incoming = removedIndex !== null
        ? moved
        : payloadToGroupItem(dropResult.payload);

      if (incoming) {
        const insertAt = Math.max(0, Math.min(addedIndex, group.items.length));
        group.items.splice(insertAt, 0, incoming);
      }
    }

    await setGroups(next);
  }

  // Convert a drag payload arriving from another group into a fresh group item
  // (new id so the same path can live in multiple groups without collisions).
  function payloadToGroupItem(payload: unknown): HomeGroupItem | undefined {
    const data = payload as HomeDirDragPayload | undefined;

    if (!data || data.source !== 'group') {
      return undefined;
    }

    return {
      ...data.item,
      id: uniqueId(),
    };
  }

  async function setDrivesOrder(paths: string[]) {
    await userSettingsStore.set('home.drivesOrder', paths);
  }

  return {
    groups,
    drivesOrder,
    resolveGroupTitle,
    ensureInitialized,
    createGroup,
    renameGroup,
    deleteGroup,
    reorderGroups,
    addItemToGroup,
    updateGroupItem,
    removeItemFromGroup,
    applyGroupDrop,
    payloadToGroupItem,
    setDrivesOrder,
  };
}
