<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref, shallowRef, computed, watch, onMounted, onBeforeUnmount,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { Loader2Icon } from '@lucide/vue';
import { hierarchy, partition, type HierarchyRectangularNode } from 'd3-hierarchy';
import { arc } from 'd3-shape';
import type { DirEntry, DirContents } from '@/types/dir-entry';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { formatBytes } from './utils';

// A node in the progressively-loaded size tree. Directories start empty and
// unloaded; the breadth-first scan fills in children and their sizes over time,
// and the sunburst re-renders as it grows (rather than blocking on a full walk).
interface MapNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  loaded: boolean;
  children: MapNode[];
}

const RING_COUNT = 6;
const MAX_SCAN_DEPTH = 6;
const MAX_DIRS = 20000; // safety budget so a giant tree can't spawn endless reads
const SCAN_CONCURRENCY = 8;
const RENDER_THROTTLE_MS = 120;

const ctx = useFileBrowserContext();
const { t } = useI18n();

const treeRoot = shallowRef<MapNode | null>(null);
// Root..focus chain; the last entry is drawn at the centre.
const breadcrumb = ref<MapNode[]>([]);
// Bumped (throttled) as the scan mutates the tree, to drive re-render.
const version = ref(0);
const scanning = ref(false);
const errorMessage = ref<string | null>(null);

const containerRef = ref<HTMLElement | null>(null);
const boxSize = ref({
  w: 0,
  h: 0,
});
const pointer = ref({
  x: 0,
  y: 0,
});
const hovered = ref<{
  name: string;
  size: number;
  percent: number;
} | null>(null);

let resizeObserver: ResizeObserver | null = null;
let scanToken = 0;
let renderTimer: ReturnType<typeof setTimeout> | null = null;

const focus = computed<MapNode | null>(
  () => breadcrumb.value[breadcrumb.value.length - 1] ?? treeRoot.value,
);

function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function makeNode(entry: DirEntry): MapNode {
  return {
    name: entry.name,
    path: entry.path,
    isDir: entry.is_dir,
    size: entry.is_dir ? 0 : Math.max(entry.size ?? 0, 0),
    loaded: !entry.is_dir,
    children: [],
  };
}

// Throttle re-renders so a fast scan doesn't recompute the layout every read.
function scheduleRender(): void {
  if (renderTimer) {
    return;
  }

  renderTimer = setTimeout(() => {
    renderTimer = null;
    version.value++;
  }, RENDER_THROTTLE_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function scan(path: string): Promise<void> {
  const token = ++scanToken;
  errorMessage.value = null;
  scanning.value = true;

  const root: MapNode = {
    name: basename(path),
    path,
    isDir: true,
    size: 0,
    loaded: false,
    children: [],
  };
  treeRoot.value = root;
  breadcrumb.value = [root];
  version.value++;

  const queue: {
    node: MapNode;
    depth: number;
  }[] = [{
    node: root,
    depth: 0,
  }];
  let active = 0;
  let dirCount = 0;

  async function expand(node: MapNode): Promise<void> {
    try {
      const result = await invoke<DirContents>('read_dir', { path: node.path });
      node.children = result.entries.map(makeNode);
    }
    catch {
      // Unreadable directory (permissions, etc.) — leave it as an empty leaf.
    }
    finally {
      node.loaded = true;
    }
  }

  async function worker(): Promise<void> {
    let running = true;

    while (running) {
      if (token !== scanToken) {
        return;
      }

      const item = queue.shift();

      if (!item) {
        if (active === 0) {
          running = false;
          continue;
        }

        await sleep(8);
        continue;
      }

      active++;
      await expand(item.node);
      active--;

      if (token !== scanToken) {
        return;
      }

      if (item.depth < MAX_SCAN_DEPTH && dirCount < MAX_DIRS) {
        for (const child of item.node.children) {
          if (child.isDir) {
            dirCount++;
            queue.push({
              node: child,
              depth: item.depth + 1,
            });

            if (dirCount >= MAX_DIRS) {
              break;
            }
          }
        }
      }

      scheduleRender();
    }
  }

  await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, () => worker()));

  if (token === scanToken) {
    scanning.value = false;
    version.value++;
  }
}

interface ArcDatum {
  x0: number;
  x1: number;
  inner: number;
  outer: number;
}

interface MapArc {
  node: MapNode;
  path: string;
  color: string;
  d: string;
  label: string | null;
  labelTransform: string;
  percent: number;
}

function colorFor(depthRel: number, hue: number): string {
  const lightness = Math.max(34, 64 - (depthRel - 1) * 7);
  return `hsl(${hue}, 52%, ${lightness}%)`;
}

const view = computed(() => {
  // Touch the reactive version so this recomputes as the scan fills the tree
  // (the tree nodes themselves are mutated non-reactively for performance).
  if (version.value < 0) {
    return {
      arcs: [] as MapArc[],
      radius: 0,
      centerRadius: 0,
      total: 0,
    };
  }

  const f = focus.value;
  const { w, h } = boxSize.value;

  if (!f || w === 0 || h === 0) {
    return {
      arcs: [] as MapArc[],
      radius: 0,
      centerRadius: 0,
      total: 0,
    };
  }

  const radius = Math.max(40, Math.min(w, h) / 2 - 12);

  const root = hierarchy<MapNode>(f, node => node.children)
    .sum(node => (node.children.length === 0 ? Math.max(node.size, 0) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  partition<MapNode>().size([2 * Math.PI, RING_COUNT])(root);

  const laidOut = root as HierarchyRectangularNode<MapNode>;
  const ringWidth = radius / RING_COUNT;
  const total = laidOut.value ?? 0;

  const topChildren = laidOut.children ?? [];
  const hueOf = new Map<HierarchyRectangularNode<MapNode>, number>();
  topChildren.forEach((child, index) => {
    hueOf.set(child, (index * 360) / Math.max(topChildren.length, 1));
  });

  const arcGen = arc<ArcDatum>()
    .startAngle(dtm => dtm.x0)
    .endAngle(dtm => dtm.x1)
    .innerRadius(dtm => dtm.inner)
    .outerRadius(dtm => dtm.outer)
    .padAngle(0.006)
    .padRadius(radius)
    .cornerRadius(3);

  const arcs: MapArc[] = [];

  for (const node of laidOut.descendants() as HierarchyRectangularNode<MapNode>[]) {
    if (node.depth === 0 || node.depth > RING_COUNT) {
      continue;
    }

    if (node.x1 - node.x0 < 0.004) {
      continue;
    }

    const region = node.ancestors().reverse()[1] as HierarchyRectangularNode<MapNode> | undefined;
    const hue = region ? hueOf.get(region) ?? 210 : 210;
    const color = colorFor(node.depth, hue);

    const d = arcGen({
      x0: node.x0,
      x1: node.x1,
      inner: node.y0 * ringWidth,
      outer: node.y1 * ringWidth,
    }) ?? '';

    const angle = node.x1 - node.x0;
    let label: string | null = null;
    let labelTransform = '';

    if (angle > 0.16 && node.depth <= 3) {
      const midAngle = (node.x0 + node.x1) / 2;
      const midRadius = ((node.y0 + node.y1) / 2) * ringWidth;
      const deg = (midAngle * 180) / Math.PI - 90;
      const flip = midAngle > Math.PI ? 180 : 0;
      labelTransform = `rotate(${deg}) translate(${midRadius},0) rotate(${flip})`;
      label = node.data.name;
    }

    arcs.push({
      node: node.data,
      path: node.data.path,
      color,
      d,
      label,
      labelTransform,
      percent: total > 0 ? ((node.value ?? 0) / total) * 100 : 0,
    });
  }

  return {
    arcs,
    radius,
    centerRadius: ringWidth,
    total,
  };
});

const hasContent = computed(() => (treeRoot.value?.children.length ?? 0) > 0);

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function onArcEnter(item: MapArc): void {
  hovered.value = {
    name: item.node.name,
    size: item.node.size,
    percent: item.percent,
  };
}

function onArcLeave(): void {
  hovered.value = null;
}

function onArcClick(item: MapArc): void {
  if (item.node.isDir && item.node.children.length > 0) {
    breadcrumb.value = [...breadcrumb.value, item.node];
  }
}

function onArcDoubleClick(item: MapArc): void {
  if (item.node.isDir && item.node.path) {
    ctx.navigateToPath(item.node.path);
  }
  else if (item.node.path) {
    ctx.openFile(item.node.path);
  }
}

function zoomToBreadcrumb(index: number): void {
  breadcrumb.value = breadcrumb.value.slice(0, index + 1);
}

function onCenterClick(): void {
  if (breadcrumb.value.length > 1) {
    breadcrumb.value = breadcrumb.value.slice(0, -1);
  }
}

function onPointerMove(event: PointerEvent): void {
  const rect = containerRef.value?.getBoundingClientRect();

  if (rect) {
    pointer.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}

watch(() => ctx.currentPath.value, (newPath) => {
  if (newPath && newPath !== treeRoot.value?.path) {
    scan(newPath);
  }
});

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;

      if (rect) {
        boxSize.value = {
          w: rect.width,
          h: rect.height,
        };
      }
    });
    resizeObserver.observe(containerRef.value);
  }

  if (ctx.currentPath.value) {
    scan(ctx.currentPath.value);
  }
});

onBeforeUnmount(() => {
  scanToken++;

  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }

  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div
    ref="containerRef"
    class="file-browser-map-view"
    @pointermove="onPointerMove"
    @contextmenu.self="ctx.handleBackgroundContextMenu"
  >
    <div
      v-if="breadcrumb.length > 0"
      class="file-browser-map-view__breadcrumb"
    >
      <template
        v-for="(node, index) in breadcrumb"
        :key="node.path + index"
      >
        <button
          type="button"
          class="file-browser-map-view__crumb"
          :class="{ 'file-browser-map-view__crumb--current': index === breadcrumb.length - 1 }"
          @click="zoomToBreadcrumb(index)"
        >
          {{ index === 0 ? node.name || node.path : node.name }}
        </button>
        <span
          v-if="index < breadcrumb.length - 1"
          class="file-browser-map-view__crumb-sep"
        >/</span>
      </template>
    </div>

    <svg
      v-if="view.radius > 0"
      class="file-browser-map-view__svg"
      :viewBox="`0 0 ${boxSize.w} ${boxSize.h}`"
    >
      <g :transform="`translate(${boxSize.w / 2}, ${boxSize.h / 2})`">
        <path
          v-for="(item, index) in view.arcs"
          :key="item.path + index"
          :d="item.d"
          :fill="item.color"
          class="file-browser-map-view__arc"
          @pointerenter="onArcEnter(item)"
          @pointerleave="onArcLeave"
          @click="onArcClick(item)"
          @dblclick="onArcDoubleClick(item)"
        />

        <text
          v-for="(item, index) in view.arcs"
          v-show="item.label"
          :key="`label-${item.path}-${index}`"
          class="file-browser-map-view__arc-label"
          :transform="item.labelTransform"
          text-anchor="middle"
          dominant-baseline="middle"
        >{{ truncate(item.label || '', 16) }}</text>

        <circle
          :r="view.centerRadius"
          class="file-browser-map-view__center"
          @click="onCenterClick"
        />
        <text
          class="file-browser-map-view__center-name"
          text-anchor="middle"
          y="-6"
        >{{ truncate(focus?.name || '', 18) }}</text>
        <text
          class="file-browser-map-view__center-size"
          text-anchor="middle"
          y="16"
        >{{ formatBytes(view.total) }}</text>
      </g>
    </svg>

    <!-- first-paint spinner only until the root's children arrive -->
    <div
      v-if="!hasContent && scanning && !errorMessage"
      class="file-browser-map-view__overlay"
    >
      <Loader2Icon
        :size="20"
        class="file-browser-map-view__spinner"
      />
      <span>{{ t('fileBrowser.mapScanning') }}</span>
    </div>
    <div
      v-else-if="errorMessage"
      class="file-browser-map-view__overlay file-browser-map-view__overlay--error"
    >
      {{ errorMessage }}
    </div>

    <!-- non-blocking indicator while deeper rings keep filling in -->
    <div
      v-if="hasContent && scanning"
      class="file-browser-map-view__scanning-pill"
    >
      <Loader2Icon
        :size="12"
        class="file-browser-map-view__spinner"
      />
      {{ t('fileBrowser.mapScanning') }}
    </div>

    <div
      v-if="hovered"
      class="file-browser-map-view__tooltip"
      :style="{ left: `${pointer.x + 16}px`, top: `${pointer.y + 16}px` }"
    >
      <div class="file-browser-map-view__tooltip-name">
        {{ hovered.name }}
      </div>
      <div class="file-browser-map-view__tooltip-meta">
        {{ formatBytes(hovered.size) }} · {{ hovered.percent.toFixed(1) }}%
      </div>
    </div>

    <div class="file-browser-map-view__hint">
      {{ t('fileBrowser.mapHint') }}
    </div>
  </div>
</template>

<style scoped>
.file-browser-map-view {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  background-color: hsl(var(--background));
}

.file-browser-map-view__breadcrumb {
  position: absolute;
  z-index: 2;
  top: 10px;
  left: 14px;
  display: flex;
  max-width: calc(100% - 28px);
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}

.file-browser-map-view__crumb {
  padding: 2px 6px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 12px;
}

.file-browser-map-view__crumb:hover {
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.file-browser-map-view__crumb--current {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.file-browser-map-view__crumb-sep {
  color: hsl(var(--muted-foreground));
  opacity: 0.6;
}

.file-browser-map-view__svg {
  display: block;
  width: 100%;
  height: 100%;
}

.file-browser-map-view__arc {
  cursor: pointer;
  stroke: hsl(var(--background));
  stroke-width: 0.75px;
  transition: opacity 0.1s ease;
}

.file-browser-map-view__arc:hover {
  opacity: 0.82;
}

.file-browser-map-view__arc-label {
  fill: #ffffff;
  font-size: 11px;
  paint-order: stroke;
  pointer-events: none;
  stroke: rgb(0 0 0 / 35%);
  stroke-width: 2px;
  user-select: none;
}

.file-browser-map-view__center {
  fill: hsl(var(--background-3));
  cursor: pointer;
  stroke: hsl(var(--border));
  stroke-width: 1px;
}

.file-browser-map-view__center-name {
  fill: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
}

.file-browser-map-view__center-size {
  fill: hsl(var(--muted-foreground));
  font-size: 11px;
  pointer-events: none;
}

.file-browser-map-view__overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: var(--radius);
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  transform: translate(-50%, -50%);
}

.file-browser-map-view__overlay--error {
  max-width: 70%;
  color: hsl(var(--destructive));
  overflow-wrap: break-word;
}

.file-browser-map-view__scanning-pill {
  position: absolute;
  top: 10px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-3) / 85%);
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.file-browser-map-view__spinner {
  animation: cool-files-ui-spin 0.8s linear infinite;
}

.file-browser-map-view__tooltip {
  position: absolute;
  z-index: 5;
  max-width: 320px;
  padding: 6px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-3));
  pointer-events: none;
}

.file-browser-map-view__tooltip-name {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-map-view__tooltip-meta {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.file-browser-map-view__hint {
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
