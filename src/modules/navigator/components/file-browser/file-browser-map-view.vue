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
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { formatBytes } from './utils';

// Nested, size-weighted tree returned by the `get_dir_size_tree` Rust command.
interface SizeNode {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  childCount: number;
  children: SizeNode[];
}

// Rings of children drawn outward from the focused directory at the centre.
const RING_COUNT = 6;
const MAX_DEPTH = 8;
const CENTER_HOLE_FACTOR = 1; // center circle spans one ring band

const ctx = useFileBrowserContext();
const { t } = useI18n();

const rootData = shallowRef<SizeNode | null>(null);
// Root..focus chain; the last entry is the directory drawn at the centre.
const breadcrumb = ref<SizeNode[]>([]);
const loading = ref(false);
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
let loadToken = 0;

const focus = computed<SizeNode | null>(
  () => breadcrumb.value[breadcrumb.value.length - 1] ?? rootData.value,
);

async function loadTree(path: string): Promise<void> {
  const token = ++loadToken;
  loading.value = true;
  errorMessage.value = null;

  try {
    const data = await invoke<SizeNode>('get_dir_size_tree', {
      path,
      maxDepth: MAX_DEPTH,
    });

    if (token !== loadToken) {
      return;
    }

    rootData.value = data;
    breadcrumb.value = [data];
  }
  catch (error) {
    if (token !== loadToken) {
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : String(error);
    rootData.value = null;
    breadcrumb.value = [];
  }
  finally {
    if (token === loadToken) {
      loading.value = false;
    }
  }
}

interface ArcDatum {
  x0: number;
  x1: number;
  inner: number;
  outer: number;
}

interface MapArc {
  node: SizeNode;
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

  const root = hierarchy<SizeNode>(f, node => node.children)
    .sum(node => (node.children && node.children.length ? 0 : Math.max(node.size, 0)))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  partition<SizeNode>().size([2 * Math.PI, RING_COUNT])(root);

  const laidOut = root as HierarchyRectangularNode<SizeNode>;
  const ringWidth = radius / RING_COUNT;
  const total = laidOut.value ?? 0;

  // Hue per first-ring region; descendants inherit their region's hue.
  const topChildren = laidOut.children ?? [];
  const hueOf = new Map<HierarchyRectangularNode<SizeNode>, number>();
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

  for (const node of laidOut.descendants() as HierarchyRectangularNode<SizeNode>[]) {
    if (node.depth === 0 || node.depth > RING_COUNT) {
      continue;
    }

    if (node.x1 - node.x0 < 0.004) {
      continue;
    }

    const region = node.ancestors().reverse()[1] as HierarchyRectangularNode<SizeNode> | undefined;
    const hue = region ? hueOf.get(region) ?? 210 : 210;
    const color = node.data.path === ''
      ? 'hsl(220, 8%, 46%)'
      : colorFor(node.depth, hue);

    const path = arcGen({
      x0: node.x0,
      x1: node.x1,
      inner: node.y0 * ringWidth,
      outer: node.y1 * ringWidth,
    }) ?? '';

    const angle = node.x1 - node.x0;
    let label: string | null = null;
    let labelTransform = '';

    // Only label roomy arcs so text stays legible.
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
      d: path,
      label,
      labelTransform,
      percent: total > 0 ? ((node.value ?? 0) / total) * 100 : 0,
    });
  }

  return {
    arcs,
    radius,
    centerRadius: ringWidth * CENTER_HOLE_FACTOR,
    total,
  };
});

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
  // Zoom the map into a directory region (no disk re-scan; we already have it).
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
  if (newPath && newPath !== rootData.value?.path) {
    loadTree(newPath);
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
    loadTree(ctx.currentPath.value);
  }
});

onBeforeUnmount(() => {
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
    <!-- breadcrumb of the zoom chain -->
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

        <!-- centre = focused directory; click to zoom out -->
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

    <!-- states -->
    <div
      v-if="loading"
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

    <!-- hover tooltip -->
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
