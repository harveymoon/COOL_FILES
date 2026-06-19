<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref, computed, watch, onMounted, onBeforeUnmount,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { Loader2Icon } from '@lucide/vue';
import { hierarchy, tree, type HierarchyPointNode, type HierarchyPointLink } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import type { DirEntry, DirContents } from '@/types/dir-entry';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useFileBrowserContext } from './composables/use-file-browser-context';

// A lazily-loaded folder-tree node. The whole tree is a plain reactive object
// graph; d3 only computes geometry (positions + link paths) from it.
interface TreeNodeData {
  path: string;
  name: string;
  isDir: boolean;
  isHidden: boolean;
  // The original entry, used to drive the shared selection (null for the root,
  // which is the current directory itself and has no parent entry).
  entry: DirEntry | null;
  expanded: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  children: TreeNodeData[];
}

// Vertical gap between sibling rows and horizontal distance between depth levels.
const NODE_ROW_GAP = 24;
const NODE_LEVEL_GAP = 220;
const INITIAL_LEFT_MARGIN = 72;

const ctx = useFileBrowserContext();
const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const rootNode = ref<TreeNodeData | null>(null);
const selectedPath = ref<string | null>(null);
const rootLoading = ref(false);
const rootError = ref<string | null>(null);

const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const view = ref({
  x: INITIAL_LEFT_MARGIN,
  y: 200,
  k: 1,
});
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;

// Guards against out-of-order async loads when the user clicks quickly or
// navigates while a directory is still being read.
let loadToken = 0;

const showHiddenFiles = computed(() => userSettingsStore.userSettings.navigator.showHiddenFiles);

function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function entryToNode(entry: DirEntry): TreeNodeData {
  return {
    path: entry.path,
    name: entry.name,
    isDir: entry.is_dir,
    isHidden: entry.is_hidden || entry.name.startsWith('.'),
    entry,
    expanded: false,
    loaded: false,
    loading: false,
    error: null,
    children: [],
  };
}

async function loadChildren(node: TreeNodeData): Promise<void> {
  if (node.loaded || node.loading) {
    return;
  }

  node.loading = true;
  node.error = null;

  try {
    const result = await invoke<DirContents>('read_dir', { path: node.path });
    node.children = result.entries.map(entryToNode);
    node.loaded = true;
  }
  catch (error) {
    node.error = error instanceof Error ? error.message : String(error);
  }
  finally {
    node.loading = false;
  }
}

async function initRoot(path: string): Promise<void> {
  const token = ++loadToken;
  rootError.value = null;
  rootLoading.value = true;
  selectedPath.value = null;

  const node: TreeNodeData = {
    path,
    name: basename(path),
    isDir: true,
    isHidden: false,
    entry: null,
    expanded: true,
    loaded: false,
    loading: false,
    error: null,
    children: [],
  };

  await loadChildren(node);

  if (token !== loadToken) {
    return;
  }

  rootError.value = node.error;
  rootLoading.value = false;
  rootNode.value = node;
}

// d3 children accessor: only descend into expanded folders, and re-filter hidden
// items reactively so the "Show hidden items" toggle updates the tree instantly.
function accessor(node: TreeNodeData): TreeNodeData[] | null {
  if (!node.isDir || !node.expanded) {
    return null;
  }

  const visible = showHiddenFiles.value
    ? node.children
    : node.children.filter(child => !child.isHidden);

  return visible.length > 0 ? visible : null;
}

const treeLayout = tree<TreeNodeData>().nodeSize([NODE_ROW_GAP, NODE_LEVEL_GAP]);

const layout = computed<{
  nodes: HierarchyPointNode<TreeNodeData>[];
  links: HierarchyPointLink<TreeNodeData>[];
}>(() => {
  if (!rootNode.value) {
    return {
      nodes: [],
      links: [],
    };
  }

  const root = treeLayout(hierarchy(rootNode.value, accessor));
  return {
    nodes: root.descendants(),
    links: root.links(),
  };
});

function linkPath(link: HierarchyPointLink<TreeNodeData>): string {
  const { source, target } = link;
  const midY = (source.y + target.y) / 2;
  return `M${source.y},${source.x}C${midY},${source.x} ${midY},${target.x} ${target.y},${target.x}`;
}

function isExpandable(node: TreeNodeData): boolean {
  return node.isDir && (!node.loaded || accessor(node) !== null || !node.expanded);
}

async function onNodeClick(node: TreeNodeData): Promise<void> {
  selectedPath.value = node.path;

  if (node.entry) {
    ctx.replaceSelection(node.entry);
  }

  if (!node.isDir) {
    return;
  }

  if (node.expanded) {
    node.expanded = false;
    return;
  }

  node.expanded = true;

  if (!node.loaded) {
    await loadChildren(node);
  }
}

function onNodeDoubleClick(node: TreeNodeData): void {
  if (node.isDir) {
    ctx.navigateToPath(node.path);
  }
  else if (node.entry) {
    ctx.openFile(node.path);
  }
}

const viewTransform = computed(
  () => `translate(${view.value.x},${view.value.y}) scale(${view.value.k})`,
);

function setupZoom(): void {
  const svgElement = svgRef.value;

  if (!svgElement) {
    return;
  }

  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 2.5])
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      view.value = {
        x: event.transform.x,
        y: event.transform.y,
        k: event.transform.k,
      };
    });

  const selection = select(svgElement);
  selection.call(zoomBehavior);

  const initialY = (containerRef.value?.clientHeight ?? 400) / 2;
  selection.call(
    zoomBehavior.transform,
    zoomIdentity.translate(INITIAL_LEFT_MARGIN, initialY),
  );
}

watch(() => ctx.currentPath.value, (newPath) => {
  if (newPath && newPath !== rootNode.value?.path) {
    initRoot(newPath);
  }
});

onMounted(() => {
  setupZoom();

  if (ctx.currentPath.value) {
    initRoot(ctx.currentPath.value);
  }
});

onBeforeUnmount(() => {
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).on('.zoom', null);
  }
});
</script>

<template>
  <div
    ref="containerRef"
    class="file-browser-tree-view"
    @contextmenu.self="ctx.handleBackgroundContextMenu"
  >
    <svg
      ref="svgRef"
      class="file-browser-tree-view__svg"
    >
      <g :transform="viewTransform">
        <path
          v-for="(link, index) in layout.links"
          :key="`link-${index}`"
          class="file-browser-tree-view__link"
          :d="linkPath(link)"
        />
        <g
          v-for="node in layout.nodes"
          :key="node.data.path"
          class="file-browser-tree-view__node"
          :class="{ 'file-browser-tree-view__node--selected': selectedPath === node.data.path }"
          :transform="`translate(${node.y},${node.x})`"
          @click="onNodeClick(node.data)"
          @dblclick="onNodeDoubleClick(node.data)"
        >
          <circle
            class="file-browser-tree-view__dot"
            :class="{
              'file-browser-tree-view__dot--dir': node.data.isDir,
              'file-browser-tree-view__dot--expanded': node.data.isDir && node.data.expanded,
              'file-browser-tree-view__dot--expandable': isExpandable(node.data),
            }"
            r="5"
          />
          <Loader2Icon
            v-if="node.data.loading"
            class="file-browser-tree-view__node-spinner"
            :size="12"
            :x="-6"
            :y="-18"
          />
          <text
            class="file-browser-tree-view__label"
            x="12"
            dy="0.32em"
          >{{ node.data.name }}</text>
        </g>
      </g>
    </svg>

    <div
      v-if="rootLoading"
      class="file-browser-tree-view__overlay"
    >
      <Loader2Icon
        :size="18"
        class="file-browser-tree-view__spinner"
      />
    </div>

    <div
      v-else-if="rootError"
      class="file-browser-tree-view__overlay file-browser-tree-view__overlay--error"
    >
      {{ rootError }}
    </div>

    <div class="file-browser-tree-view__hint">
      {{ t('fileBrowser.treeHint') }}
    </div>
  </div>
</template>

<style scoped>
.file-browser-tree-view {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  background-color: hsl(var(--background));
}

.file-browser-tree-view__svg {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}

.file-browser-tree-view__svg:active {
  cursor: grabbing;
}

.file-browser-tree-view__link {
  fill: none;
  stroke: hsl(var(--border));
  stroke-width: 1.5px;
}

.file-browser-tree-view__node {
  cursor: pointer;
}

.file-browser-tree-view__dot {
  fill: hsl(var(--background));
  stroke: hsl(var(--muted-foreground));
  stroke-width: 1.5px;
  transition: fill 0.12s ease, stroke 0.12s ease;
}

.file-browser-tree-view__dot--dir {
  stroke: hsl(var(--primary));
}

/* A collapsed folder that still has children to reveal reads as "filled". */
.file-browser-tree-view__dot--expandable:not(.file-browser-tree-view__dot--expanded) {
  fill: hsl(var(--primary));
}

.file-browser-tree-view__node:hover .file-browser-tree-view__dot {
  stroke: hsl(var(--primary));
}

.file-browser-tree-view__label {
  fill: hsl(var(--foreground));
  font-size: 12px;
  pointer-events: none;
  user-select: none;
}

.file-browser-tree-view__node--selected .file-browser-tree-view__label {
  fill: hsl(var(--primary));
  font-weight: 600;
}

.file-browser-tree-view__node--selected .file-browser-tree-view__dot {
  stroke: hsl(var(--primary));
}

.file-browser-tree-view__node-spinner {
  color: hsl(var(--muted-foreground));
  animation: cool-files-ui-spin 0.8s linear infinite;
}

.file-browser-tree-view__overlay {
  position: absolute;
  top: 16px;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: var(--radius);
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  transform: translateX(-50%);
}

.file-browser-tree-view__overlay--error {
  max-width: 70%;
  color: hsl(var(--destructive));
  overflow-wrap: break-word;
}

.file-browser-tree-view__spinner {
  animation: cool-files-ui-spin 0.8s linear infinite;
}

.file-browser-tree-view__hint {
  position: absolute;
  right: 12px;
  bottom: 10px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-3) / 70%);
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  pointer-events: none;
  user-select: none;
}
</style>
