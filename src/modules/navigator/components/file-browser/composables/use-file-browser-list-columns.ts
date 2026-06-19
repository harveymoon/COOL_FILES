// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Shared layer for the navigator list-view columns: builds the CSS
// `grid-template-columns` value (consumed via the `--file-browser-list-columns`
// custom property by the header, rows, and loading skeleton) and drives
// interactive column resizing from the header's drag handles.
//
// Every visible column gets a fixed pixel track followed by a trailing flexible
// spacer track that absorbs leftover width (and collapses so the columns can
// overflow into a horizontal scroll). Widths persist in
// `navigator.listColumnWidths`; while a handle is being dragged a module-level
// override is applied so the grid updates every frame without writing to disk on
// every pointer move (the value is persisted once on release).

import { computed, ref } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { ListColumnVisibility, ListSortColumn } from '@/types/user-settings';

export type ListColumnKey = ListSortColumn;

// Minimum width per column (px). Name keeps a larger floor so the icon + label
// stay legible; metadata columns can shrink further.
export const LIST_COLUMN_MIN_WIDTHS: Record<ListColumnKey, number> = {
  name: 120,
  type: 60,
  items: 60,
  size: 60,
  modified: 90,
  created: 90,
  tags: 80,
};

export const LIST_COLUMN_MAX_WIDTH = 900;

// Metadata columns in display order (name is always rendered first).
export const LIST_METADATA_COLUMN_ORDER: Exclude<ListColumnKey, 'name'>[] = [
  'type',
  'items',
  'size',
  'modified',
  'created',
  'tags',
];

// Width applied live while a header handle is dragged. Module-level so the
// header (writer) and content (reader) stay in sync, including across split-view
// panes, which share the same persisted widths.
const dragOverride = ref<{
  key: ListColumnKey;
  width: number;
} | null>(null);

export function useFileBrowserListColumns() {
  const userSettingsStore = useUserSettingsStore();

  const visibility = computed<ListColumnVisibility>(
    () => userSettingsStore.userSettings.navigator.listColumnVisibility,
  );
  const widths = computed(() => userSettingsStore.userSettings.navigator.listColumnWidths);

  function widthOf(key: ListColumnKey): number {
    if (dragOverride.value?.key === key) {
      return dragOverride.value.width;
    }

    return widths.value[key] ?? LIST_COLUMN_MIN_WIDTHS[key];
  }

  // Visible columns in display order; name is always present and first.
  const visibleColumns = computed<ListColumnKey[]>(() => {
    const columns: ListColumnKey[] = ['name'];

    for (const key of LIST_METADATA_COLUMN_ORDER) {
      if (visibility.value[key]) {
        columns.push(key);
      }
    }

    return columns;
  });

  const columnsTemplate = computed(() => {
    const tracks = visibleColumns.value.map(key => `${widthOf(key)}px`);
    // Trailing spacer absorbs leftover width and collapses to 0 to allow the
    // columns to overflow into a horizontal scroll.
    tracks.push('minmax(0, 1fr)');
    return tracks.join(' ');
  });

  function clampWidth(key: ListColumnKey, width: number): number {
    const min = LIST_COLUMN_MIN_WIDTHS[key];
    return Math.max(min, Math.min(LIST_COLUMN_MAX_WIDTH, Math.round(width)));
  }

  function beginResize(key: ListColumnKey) {
    dragOverride.value = {
      key,
      width: widthOf(key),
    };
  }

  function updateResize(key: ListColumnKey, width: number) {
    dragOverride.value = {
      key,
      width: clampWidth(key, width),
    };
  }

  async function endResize() {
    const pending = dragOverride.value;

    if (!pending) {
      return;
    }

    // `set` updates the in-memory reactive value synchronously before its async
    // disk write, so apply it before clearing the override to avoid a one-frame
    // flash back to the previous width.
    const persisted = userSettingsStore.set(`navigator.listColumnWidths.${pending.key}`, pending.width);
    dragOverride.value = null;
    await persisted;
  }

  return {
    visibleColumns,
    columnsTemplate,
    widthOf,
    beginResize,
    updateResize,
    endResize,
  };
}
