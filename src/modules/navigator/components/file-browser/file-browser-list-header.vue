<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  InfoIcon, Columns3Icon, ArrowUpIcon, ArrowDownIcon, CheckIcon,
} from '@lucide/vue';
import type { ListColumnVisibility, ListSortColumn } from '@/types/user-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useFileBrowserListColumns, type ListColumnKey } from './composables/use-file-browser-list-columns';

const { t } = useI18n();
const legendSizeText = '1.5 GB';
const userSettingsStore = useUserSettingsStore();
const isColumnsPopoverOpen = ref(false);

const {
  beginResize,
  updateResize,
  endResize,
  widthOf,
} = useFileBrowserListColumns();

// Drives the column resize handles. While dragging, the live width is held by
// the shared composable (applied to the grid every frame) and persisted on
// release.
const resizingKey = ref<ListColumnKey | null>(null);
let resizeStartX = 0;
let resizeStartWidth = 0;

function onResizePointerDown(key: ListColumnKey, event: PointerEvent) {
  // Don't let the pointerdown reach the column's sort button.
  event.preventDefault();
  event.stopPropagation();
  resizingKey.value = key;
  resizeStartX = event.clientX;
  resizeStartWidth = widthOf(key);
  beginResize(key);
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onResizePointerMove(event: PointerEvent) {
  if (!resizingKey.value) {
    return;
  }

  updateResize(resizingKey.value, resizeStartWidth + (event.clientX - resizeStartX));
}

function onResizePointerUp(event: PointerEvent) {
  if (!resizingKey.value) {
    return;
  }

  const target = event.currentTarget as HTMLElement;

  if (target.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }

  resizingKey.value = null;
  void endResize();
}

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const showItemsColumn = computed(() => columnVisibility.value.items);

const listSortColumn = computed(() => userSettingsStore.userSettings.navigator.listSortColumn);
const listSortDirection = computed(() => userSettingsStore.userSettings.navigator.listSortDirection);

function handleColumnHeaderClick(column: ListSortColumn) {
  if (listSortColumn.value === column) {
    userSettingsStore.set('navigator.listSortDirection', listSortDirection.value === 'asc' ? 'desc' : 'asc');
  }
  else {
    userSettingsStore.set('navigator.listSortColumn', column);
    userSettingsStore.set('navigator.listSortDirection', 'asc');
  }
}

function toggleColumnVisibility(column: keyof ListColumnVisibility, checked: boolean) {
  userSettingsStore.set(`navigator.listColumnVisibility.${column}`, checked);
}

// The toggleable columns (Name is always shown), shared by the columns popover
// and the header right-click menu.
const columnOptions = computed<{
  key: keyof ListColumnVisibility;
  label: string;
}[]>(() => [
  {
    key: 'type',
    label: t('fileBrowser.type'),
  },
  {
    key: 'items',
    label: t('items'),
  },
  {
    key: 'size',
    label: t('fileBrowser.size'),
  },
  {
    key: 'sizeBar',
    label: t('fileBrowser.sizeBar'),
  },
  {
    key: 'modified',
    label: t('fileBrowser.modified'),
  },
  {
    key: 'created',
    label: t('created'),
  },
  {
    key: 'tags',
    label: t('fileBrowser.tags'),
  },
]);
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div class="file-browser-list-view__header-container">
        <div class="file-browser-list-view__header">
          <div class="file-browser-list-view__header-cell">
            <button
              type="button"
              class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-name"
              @click="handleColumnHeaderClick('name')"
            >
              {{ t('fileBrowser.name') }}
              <ArrowUpIcon
                v-if="listSortColumn === 'name' && listSortDirection === 'asc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
              <ArrowDownIcon
                v-else-if="listSortColumn === 'name' && listSortDirection === 'desc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
            </button>
            <div
              class="file-browser-list-view__header-resizer"
              :class="{ 'file-browser-list-view__header-resizer--active': resizingKey === 'name' }"
              :title="t('fileBrowser.resizeColumn')"
              @pointerdown="onResizePointerDown('name', $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </div>
          <div
            v-if="columnVisibility.type"
            class="file-browser-list-view__header-cell"
          >
            <button
              type="button"
              class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-type"
              @click="handleColumnHeaderClick('type')"
            >
              {{ t('fileBrowser.type') }}
              <ArrowUpIcon
                v-if="listSortColumn === 'type' && listSortDirection === 'asc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
              <ArrowDownIcon
                v-else-if="listSortColumn === 'type' && listSortDirection === 'desc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
            </button>
            <div
              class="file-browser-list-view__header-resizer"
              :class="{ 'file-browser-list-view__header-resizer--active': resizingKey === 'type' }"
              :title="t('fileBrowser.resizeColumn')"
              @pointerdown="onResizePointerDown('type', $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </div>
          <div
            v-if="showItemsColumn"
            class="file-browser-list-view__header-cell"
          >
            <button
              type="button"
              class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-items"
              @click="handleColumnHeaderClick('items')"
            >
              {{ t('items') }}
              <ArrowUpIcon
                v-if="listSortColumn === 'items' && listSortDirection === 'asc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
              <ArrowDownIcon
                v-else-if="listSortColumn === 'items' && listSortDirection === 'desc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
            </button>
            <div
              class="file-browser-list-view__header-resizer"
              :class="{ 'file-browser-list-view__header-resizer--active': resizingKey === 'items' }"
              :title="t('fileBrowser.resizeColumn')"
              @pointerdown="onResizePointerDown('items', $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </div>
          <div
            v-if="columnVisibility.size"
            class="file-browser-list-view__header-cell"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-size file-browser-list-view__header-size--with-info"
                  @click="handleColumnHeaderClick('size')"
                >
                  {{ t('fileBrowser.size') }}
                  <InfoIcon
                    :size="12"
                    class="file-browser-list-view__header-info-icon"
                  />
                  <ArrowUpIcon
                    v-if="listSortColumn === 'size' && listSortDirection === 'asc'"
                    :size="12"
                    class="file-browser-list-view__header-sort-icon"
                  />
                  <ArrowDownIcon
                    v-else-if="listSortColumn === 'size' && listSortDirection === 'desc'"
                    :size="12"
                    class="file-browser-list-view__header-sort-icon"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                :side-offset="8"
                class="file-browser-list-view__size-tooltip"
              >
                <div class="file-browser-list-view__size-tooltip-content">
                  <div class="file-browser-list-view__size-tooltip-title">
                    {{ t('fileBrowser.sizeTooltip.title') }}
                  </div>
                  <div class="file-browser-list-view__size-tooltip-body">
                    <div class="file-browser-list-view__size-tooltip-item">
                      <span class="file-browser-list-view__size-tooltip-label">{{ legendSizeText }}</span>
                      <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.exact') }}</span>
                    </div>
                    <div class="file-browser-list-view__size-tooltip-item">
                      <span class="file-browser-list-view__size-tooltip-label file-browser-list-view__size-tooltip-label--loading">
                        <Skeleton class="file-browser-list-view__size-tooltip-skeleton" />
                      </span>
                      <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.loading') }}</span>
                    </div>
                    <div class="file-browser-list-view__size-tooltip-item">
                      <span class="file-browser-list-view__size-tooltip-label file-browser-list-view__size-tooltip-label--empty">—</span>
                      <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.notCalculated') }}</span>
                    </div>
                  </div>
                  <div class="file-browser-list-view__size-tooltip-note">
                    {{ t('fileBrowser.sizeTooltip.note') }}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
            <div
              class="file-browser-list-view__header-resizer"
              :class="{ 'file-browser-list-view__header-resizer--active': resizingKey === 'size' }"
              :title="t('fileBrowser.resizeColumn')"
              @pointerdown="onResizePointerDown('size', $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </div>
          <div
            v-if="columnVisibility.sizeBar"
            class="file-browser-list-view__header-cell"
          >
            <span class="file-browser-list-view__header-item file-browser-list-view__header-sizebar">
              {{ t('fileBrowser.sizeBar') }}
            </span>
            <div
              class="file-browser-list-view__header-resizer"
              :class="{ 'file-browser-list-view__header-resizer--active': resizingKey === 'sizeBar' }"
              :title="t('fileBrowser.resizeColumn')"
              @pointerdown="onResizePointerDown('sizeBar', $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </div>
          <div
            v-if="columnVisibility.modified"
            class="file-browser-list-view__header-cell"
          >
            <button
              type="button"
              class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-modified"
              @click="handleColumnHeaderClick('modified')"
            >
              {{ t('fileBrowser.modified') }}
              <ArrowUpIcon
                v-if="listSortColumn === 'modified' && listSortDirection === 'asc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
              <ArrowDownIcon
                v-else-if="listSortColumn === 'modified' && listSortDirection === 'desc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
            </button>
            <div
              class="file-browser-list-view__header-resizer"
              :class="{ 'file-browser-list-view__header-resizer--active': resizingKey === 'modified' }"
              :title="t('fileBrowser.resizeColumn')"
              @pointerdown="onResizePointerDown('modified', $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </div>
          <div
            v-if="columnVisibility.created"
            class="file-browser-list-view__header-cell"
          >
            <button
              type="button"
              class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-created"
              @click="handleColumnHeaderClick('created')"
            >
              {{ t('created') }}
              <ArrowUpIcon
                v-if="listSortColumn === 'created' && listSortDirection === 'asc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
              <ArrowDownIcon
                v-else-if="listSortColumn === 'created' && listSortDirection === 'desc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
            </button>
            <div
              class="file-browser-list-view__header-resizer"
              :class="{ 'file-browser-list-view__header-resizer--active': resizingKey === 'created' }"
              :title="t('fileBrowser.resizeColumn')"
              @pointerdown="onResizePointerDown('created', $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </div>
          <div
            v-if="columnVisibility.tags"
            class="file-browser-list-view__header-cell"
          >
            <button
              type="button"
              class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-tags"
              @click="handleColumnHeaderClick('tags')"
            >
              {{ t('fileBrowser.tags') }}
              <ArrowUpIcon
                v-if="listSortColumn === 'tags' && listSortDirection === 'asc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
              <ArrowDownIcon
                v-else-if="listSortColumn === 'tags' && listSortDirection === 'desc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
            </button>
            <div
              class="file-browser-list-view__header-resizer"
              :class="{ 'file-browser-list-view__header-resizer--active': resizingKey === 'tags' }"
              :title="t('fileBrowser.resizeColumn')"
              @pointerdown="onResizePointerDown('tags', $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </div>
        </div>
        <Popover
          :open="isColumnsPopoverOpen"
          @update:open="isColumnsPopoverOpen = $event"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="file-browser-list-view__columns-button"
                >
                  <Columns3Icon :size="14" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <PopoverContent
              :side="'bottom'"
              :align="'end'"
              class="file-browser-list-view__columns-popover"
            >
              <div class="file-browser-list-view__columns-option">
                <Checkbox
                  id="column-type"
                  :model-value="columnVisibility.type"
                  @update:model-value="toggleColumnVisibility('type', $event as boolean)"
                />
                <Label for="column-type">{{ t('fileBrowser.type') }}</Label>
              </div>
              <div class="file-browser-list-view__columns-option">
                <Checkbox
                  id="column-items"
                  :model-value="columnVisibility.items"
                  @update:model-value="toggleColumnVisibility('items', $event as boolean)"
                />
                <Label for="column-items">{{ t('items') }}</Label>
              </div>
              <div class="file-browser-list-view__columns-option">
                <Checkbox
                  id="column-size"
                  :model-value="columnVisibility.size"
                  @update:model-value="toggleColumnVisibility('size', $event as boolean)"
                />
                <Label for="column-size">{{ t('fileBrowser.size') }}</Label>
              </div>
              <div class="file-browser-list-view__columns-option">
                <Checkbox
                  id="column-size-bar"
                  :model-value="columnVisibility.sizeBar"
                  @update:model-value="toggleColumnVisibility('sizeBar', $event as boolean)"
                />
                <Label for="column-size-bar">{{ t('fileBrowser.sizeBar') }}</Label>
              </div>
              <div class="file-browser-list-view__columns-option">
                <Checkbox
                  id="column-modified"
                  :model-value="columnVisibility.modified"
                  @update:model-value="toggleColumnVisibility('modified', $event as boolean)"
                />
                <Label for="column-modified">{{ t('fileBrowser.modified') }}</Label>
              </div>
              <div class="file-browser-list-view__columns-option">
                <Checkbox
                  id="column-created"
                  :model-value="columnVisibility.created"
                  @update:model-value="toggleColumnVisibility('created', $event as boolean)"
                />
                <Label for="column-created">{{ t('created') }}</Label>
              </div>
              <div class="file-browser-list-view__columns-option">
                <Checkbox
                  id="column-tags"
                  :model-value="columnVisibility.tags"
                  @update:model-value="toggleColumnVisibility('tags', $event as boolean)"
                />
                <Label for="column-tags">{{ t('fileBrowser.tags') }}</Label>
              </div>
            </PopoverContent>
            <TooltipContent>
              {{ t('fileBrowser.columns') }}
            </TooltipContent>
          </Tooltip>
        </Popover>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent
      align="start"
      class="file-browser-list-view__columns-menu"
    >
      <ContextMenuLabel>{{ t('fileBrowser.columns') }}</ContextMenuLabel>
      <ContextMenuSeparator />
      <ContextMenuItem
        v-for="option in columnOptions"
        :key="option.key"
        @select.prevent="toggleColumnVisibility(option.key, !columnVisibility[option.key])"
      >
        <CheckIcon
          :size="14"
          class="file-browser-list-view__columns-menu-check"
          :class="{ 'file-browser-list-view__columns-menu-check--hidden': !columnVisibility[option.key] }"
        />
        {{ option.label }}
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<style scoped>
.file-browser-list-view__header {
  display: grid;
  padding: var(--file-browser-list-header-padding-y) var(--file-browser-list-header-padding-x);
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  column-gap: var(--file-browser-list-column-gap);
  font-size: 12px;
  font-weight: 500;
  grid-template-columns: var(--file-browser-list-columns);
  line-height: 1rem;
  text-transform: uppercase;
}

.file-browser-list-view__header-container {
  position: sticky;
  z-index: 3;
  top: 0;
  flex-shrink: 0;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--background-3));
}

/* Each column occupies its grid track via this wrapper; the label button keeps
   its fit-content size and left alignment, and the resize handle sits at the
   track's right edge (centered over the column gap). */
.file-browser-list-view__header-cell {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
}

.file-browser-list-view__header-resizer {
  position: absolute;
  top: 0;
  right: calc(var(--file-browser-list-column-gap) / -2 - 4px);
  bottom: 0;
  z-index: 4;
  width: 9px;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
}

.file-browser-list-view__header-resizer::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 50%;
  width: 2px;
  border-radius: 1px;
  background-color: transparent;
  content: '';
  transform: translateX(-50%);
  transition: background-color 0.15s ease;
}

.file-browser-list-view__header-resizer:hover::before,
.file-browser-list-view__header-resizer--active::before {
  background-color: hsl(var(--primary) / 60%);
}

.file-browser-list-view__header-item {
  display: flex;
  width: fit-content;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  gap: 8px;
}

.file-browser-list-view__header-item--sortable {
  border: none;
  margin: -2px -6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-transform: inherit;
}

.file-browser-list-view__header-item--sortable:hover {
  color: hsl(var(--foreground));
}

.file-browser-list-view__header-item--sortable:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.file-browser-list-view__header-sort-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.file-browser-list-view__header-info-icon {
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.file-browser-list-view__header-size--with-info:hover .file-browser-list-view__header-info-icon {
  opacity: 1;
}

.file-browser-list-view__size-tooltip {
  max-width: 300px;
}

.file-browser-list-view__size-tooltip-content {
  display: flex;
  max-width: 300px;
  flex-direction: column;
  gap: 10px;
}

.file-browser-list-view__size-tooltip-title {
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.file-browser-list-view__size-tooltip-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-browser-list-view__size-tooltip-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-browser-list-view__size-tooltip-label {
  display: inline-flex;
  width: 70px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  font-weight: 500;
}

.file-browser-list-view__size-tooltip-label--loading {
  background-color: transparent;
}

.file-browser-list-view__size-tooltip-skeleton {
  width: 100%;
  height: 12px;
}

.file-browser-list-view__size-tooltip-label--empty {
  background-color: hsl(var(--muted) / 30%);
  color: hsl(var(--muted-foreground));
}

.file-browser-list-view__size-tooltip-desc {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.4;
}

.file-browser-list-view__size-tooltip-note {
  padding-top: 6px;
  border-top: 1px solid hsl(var(--border) / 50%);
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-style: italic;
  line-height: 1.4;
}

.file-browser-list-view__columns-button {
  position: absolute;
  top: 50%;
  right: 0;
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
  transform: translateY(-50%);
}
</style>

<style>
.file-browser-list-view__columns-popover.cool-files-ui-popover-content {
  display: flex;
  width: auto;
  flex-direction: column;
  padding: 8px 12px;
  gap: 8px;
}

.file-browser-list-view__columns-option {
  display: flex;
  align-items: center;
  gap: 8px;
  text-transform: capitalize;
}

.file-browser-list-view__columns-option .cool-files-ui-label {
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}

.file-browser-list-view__columns-menu-check {
  flex-shrink: 0;
  color: hsl(var(--primary));
}

/* Keep the row width stable when a column is hidden (no check shown). */
.file-browser-list-view__columns-menu-check--hidden {
  visibility: hidden;
}
</style>
