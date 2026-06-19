<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { ChevronRightIcon, Loader2Icon } from '@lucide/vue';
import type { DirEntry, DirContents } from '@/types/dir-entry';
import toReadableBytes from '@/utils/to-readable-bytes';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import FileBrowserContextMenu from './file-browser-context-menu.vue';

interface ColumnState {
  path: string;
  entries: DirEntry[];
  selectedEntryPath: string | null;
  isLoading: boolean;
  error: string | null;
}

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif',
]);

const ctx = useFileBrowserContext();
const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

// Matches the hidden-file rule used by the list/grid views (useFileBrowserEntries),
// so the "Show hidden items" toggle behaves consistently across all layouts.
function isHiddenEntry(entry: DirEntry): boolean {
  return entry.is_hidden || entry.name.startsWith('.');
}

// Reactive: reading `showHiddenFiles` here means toggling the setting re-filters
// every rendered column instantly, without reloading any directory.
function visibleEntries(column: ColumnState): DirEntry[] {
  if (userSettingsStore.userSettings.navigator.showHiddenFiles) {
    return column.entries;
  }

  return column.entries.filter(entry => !isHiddenEntry(entry));
}

const columns = ref<ColumnState[]>([]);
const selectedFile = ref<DirEntry | null>(null);
const previewImageFailed = ref(false);
const columnsContainer = ref<HTMLElement | null>(null);

// A monotonically increasing token guards against out-of-order async loads:
// if the user clicks quickly, only the latest load is allowed to mutate state.
let loadToken = 0;

async function loadEntries(path: string): Promise<DirContents> {
  return invoke<DirContents>('read_dir', { path });
}

function scrollToEnd() {
  requestAnimationFrame(() => {
    const container = columnsContainer.value;

    if (container) {
      container.scrollLeft = container.scrollWidth;
    }
  });
}

// Builds the chain from scratch with `path` as the leftmost column. Used on mount
// and whenever the browser navigates somewhere not already shown in the chain.
async function initChain(path: string) {
  const token = ++loadToken;
  selectedFile.value = null;
  previewImageFailed.value = false;
  columns.value = [{
    path,
    entries: [],
    selectedEntryPath: null,
    isLoading: true,
    error: null,
  }];

  try {
    const result = await loadEntries(path);

    if (token !== loadToken) {
      return;
    }

    columns.value = [{
      path: result.path,
      entries: result.entries,
      selectedEntryPath: null,
      isLoading: false,
      error: null,
    }];
  }
  catch (err) {
    if (token !== loadToken) {
      return;
    }

    columns.value = [{
      path,
      entries: [],
      selectedEntryPath: null,
      isLoading: false,
      error: err instanceof Error ? err.message : String(err),
    }];
  }
}

async function handleSelectFolder(columnIndex: number, entry: DirEntry) {
  const token = ++loadToken;
  selectedFile.value = null;
  previewImageFailed.value = false;

  // Mark selection and drop any columns to the right of the clicked one.
  const truncated = columns.value.slice(0, columnIndex + 1);
  truncated[columnIndex] = {
    ...truncated[columnIndex],
    selectedEntryPath: entry.path,
  };
  truncated.push({
    path: entry.path,
    entries: [],
    selectedEntryPath: null,
    isLoading: true,
    error: null,
  });
  columns.value = truncated;
  scrollToEnd();

  let loaded: DirContents | null = null;
  let loadError: string | null = null;

  try {
    loaded = await loadEntries(entry.path);
  }
  catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  if (token !== loadToken) {
    return;
  }

  const newColumnIndex = columnIndex + 1;
  const next = columns.value.slice();

  if (!next[newColumnIndex]) {
    return;
  }

  // Use the loaded (normalized) path so it matches the `currentPath` that
  // `navigateToPath` will produce below — otherwise the watcher could see a
  // mismatch and needlessly rebuild the chain.
  const resolvedPath = loaded?.path ?? entry.path;

  next[newColumnIndex] = {
    path: resolvedPath,
    entries: loaded?.entries ?? [],
    selectedEntryPath: null,
    isLoading: false,
    error: loadError,
  };
  columns.value = next;

  // Clear any file selection so the info panel falls back to showing the folder
  // we just navigated into (currentDirEntry) rather than a stale selected file.
  ctx.clearSelection();

  // Keep the rest of the app (address bar, status bar, list/grid view) in sync.
  // This sets currentPath to the same resolved path the watcher recognises as the
  // chain's last column, so it skips a rebuild and there is no feedback loop.
  ctx.navigateToPath(resolvedPath);
  scrollToEnd();
}

function handleSelectFile(columnIndex: number, entry: DirEntry) {
  const truncated = columns.value.slice(0, columnIndex + 1);
  truncated[columnIndex] = {
    ...truncated[columnIndex],
    selectedEntryPath: entry.path,
  };
  columns.value = truncated;
  previewImageFailed.value = false;
  selectedFile.value = entry;

  // Push the click into the shared selection system so the info panel (which reads
  // the navigator's selectedEntries) reflects the file picked here. Folders update
  // the info panel via currentDirEntry when navigated into, so they need no call.
  ctx.replaceSelection(entry);
  scrollToEnd();
}

function handleEntryClick(columnIndex: number, entry: DirEntry) {
  if (entry.is_dir) {
    handleSelectFolder(columnIndex, entry);
  }
  else {
    handleSelectFile(columnIndex, entry);
  }
}

function handleEntryDoubleClick(entry: DirEntry) {
  if (entry.is_file) {
    ctx.openFile(entry.path);
  }
}

// Right-click on an entry: target it in the shared selection/context-menu state
// (handleEntryContextMenu selects it first if it isn't already), then let the
// event bubble to the ContextMenuTrigger so the menu opens.
function handleEntryContextMenu(entry: DirEntry) {
  ctx.handleEntryContextMenu(entry);
}

// Right-click on empty space (column padding, preview, gaps) opens the
// background menu. Skip when the click lands on an entry, which handles itself.
function handleColumnsContextMenu(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('.file-browser-columns-view__entry')) {
    return;
  }

  ctx.handleBackgroundContextMenu();
}

function isSelected(column: ColumnState, entry: DirEntry): boolean {
  return column.selectedEntryPath === entry.path;
}

function previewImageSrc(entry: DirEntry): string | null {
  if (!entry.is_file || !entry.ext || !IMAGE_EXTENSIONS.has(entry.ext)) {
    return null;
  }

  try {
    return convertFileSrc(entry.path);
  }
  catch {
    return null;
  }
}

function formatDate(unixMs: number): string {
  if (!unixMs) {
    return '—';
  }

  return new Date(unixMs).toLocaleString();
}

// React to navigation that happens outside the columns view (address bar, sidebar,
// tab switch, go up/back). If the new path is already a column, truncate to it to
// preserve the left-hand context; otherwise rebuild the chain from that path.
watch(() => ctx.currentPath.value, (newPath) => {
  if (!newPath) {
    return;
  }

  const lastColumn = columns.value[columns.value.length - 1];

  if (lastColumn && lastColumn.path === newPath) {
    return;
  }

  const existingIndex = columns.value.findIndex(column => column.path === newPath);

  if (existingIndex !== -1) {
    selectedFile.value = null;
    columns.value = columns.value.slice(0, existingIndex + 1);
    return;
  }

  initChain(newPath);
});

onMounted(() => {
  if (ctx.currentPath.value) {
    initChain(ctx.currentPath.value);
  }
});
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        ref="columnsContainer"
        class="file-browser-columns-view"
        @contextmenu="handleColumnsContextMenu"
      >
        <div
          v-for="(column, columnIndex) in columns"
          :key="column.path + ':' + columnIndex"
          class="file-browser-columns-view__column"
        >
          <div
            v-if="column.isLoading"
            class="file-browser-columns-view__state"
          >
            <Loader2Icon
              :size="16"
              class="file-browser-columns-view__spinner"
            />
          </div>

          <div
            v-else-if="column.error"
            class="file-browser-columns-view__state file-browser-columns-view__state--error"
          >
            {{ column.error }}
          </div>

          <div
            v-else-if="visibleEntries(column).length === 0"
            class="file-browser-columns-view__state"
          >
            {{ t('fileBrowser.directoryIsEmpty') }}
          </div>

          <div
            v-else
            class="file-browser-columns-view__list"
          >
            <button
              v-for="entry in visibleEntries(column)"
              :key="entry.path"
              type="button"
              class="file-browser-columns-view__entry"
              :class="{ 'file-browser-columns-view__entry--selected': isSelected(column, entry) }"
              @click="handleEntryClick(columnIndex, entry)"
              @dblclick="handleEntryDoubleClick(entry)"
              @contextmenu="handleEntryContextMenu(entry)"
            >
              <FileBrowserEntryIcon
                :entry="entry"
                :size="18"
                class="file-browser-columns-view__entry-icon"
              />
              <span class="file-browser-columns-view__entry-name">{{ entry.name }}</span>
              <ChevronRightIcon
                v-if="entry.is_dir"
                :size="14"
                class="file-browser-columns-view__entry-chevron"
              />
            </button>
          </div>
        </div>

        <div
          v-if="selectedFile"
          class="file-browser-columns-view__preview"
        >
          <div class="file-browser-columns-view__preview-media">
            <img
              v-if="previewImageSrc(selectedFile) && !previewImageFailed"
              :src="previewImageSrc(selectedFile)!"
              class="file-browser-columns-view__preview-image"
              alt=""
              @error="previewImageFailed = true"
            >
            <FileBrowserEntryIcon
              v-else
              :entry="selectedFile"
              :size="96"
            />
          </div>

          <div class="file-browser-columns-view__preview-name">
            {{ selectedFile.name }}
          </div>

          <dl class="file-browser-columns-view__preview-details">
            <div class="file-browser-columns-view__preview-row">
              <dt>{{ t('size') }}</dt>
              <dd>{{ toReadableBytes(selectedFile.size, 1) }}</dd>
            </div>
            <div class="file-browser-columns-view__preview-row">
              <dt>{{ t('dateModified') }}</dt>
              <dd>{{ formatDate(selectedFile.modified_time) }}</dd>
            </div>
            <div class="file-browser-columns-view__preview-row">
              <dt>{{ t('dateCreated') }}</dt>
              <dd>{{ formatDate(selectedFile.created_time) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </ContextMenuTrigger>
    <FileBrowserContextMenu
      v-if="ctx.contextMenu.value.selectedEntries.length > 0"
    />
  </ContextMenu>
</template>

<style scoped>
.file-browser-columns-view {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
}

.file-browser-columns-view__column {
  display: flex;
  width: 260px;
  min-width: 260px;
  height: 100%;
  flex-direction: column;
  border-right: 1px solid hsl(var(--border));
  overflow-y: auto;
}

.file-browser-columns-view__list {
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 1px;
}

.file-browser-columns-view__state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: center;
}

.file-browser-columns-view__state--error {
  color: hsl(var(--destructive));
  overflow-wrap: break-word;
}

.file-browser-columns-view__spinner {
  animation: cool-files-ui-spin 0.8s linear infinite;
}

.file-browser-columns-view__entry {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 5px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  gap: 8px;
  text-align: left;
  transition: background-color 0.1s ease;
}

.file-browser-columns-view__entry:hover {
  background-color: hsl(var(--muted));
}

.file-browser-columns-view__entry--selected {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.file-browser-columns-view__entry-icon {
  flex-shrink: 0;
}

.file-browser-columns-view__entry-name {
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-columns-view__entry-chevron {
  flex-shrink: 0;
  opacity: 0.6;
}

.file-browser-columns-view__preview {
  display: flex;
  width: 280px;
  min-width: 280px;
  height: 100%;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  gap: 12px;
  overflow-y: auto;
}

.file-browser-columns-view__preview-media {
  display: flex;
  width: 100%;
  height: 180px;
  align-items: center;
  justify-content: center;
}

.file-browser-columns-view__preview-image {
  max-width: 100%;
  max-height: 180px;
  border-radius: var(--radius);
  object-fit: contain;
}

.file-browser-columns-view__preview-name {
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
  text-align: center;
}

.file-browser-columns-view__preview-details {
  display: flex;
  width: 100%;
  flex-direction: column;
  margin: 0;
  gap: 6px;
}

.file-browser-columns-view__preview-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.file-browser-columns-view__preview-row dt {
  color: hsl(var(--muted-foreground));
}

.file-browser-columns-view__preview-row dd {
  margin: 0;
  overflow-wrap: anywhere;
  text-align: right;
}
</style>
