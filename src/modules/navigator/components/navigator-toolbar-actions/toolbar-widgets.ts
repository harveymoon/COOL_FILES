// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw, type Component } from 'vue';
import {
  CommandIcon,
  SearchIcon,
  Share2Icon,
  ActivityIcon,
} from '@lucide/vue';
import type { ToolbarWidgetId } from '@/types/user-settings';
import { GlobalSearchToolbarButton } from '@/modules/global-search';
import { LanShareToolbarButton } from '@/modules/lan-share';
import { StatusCenterToolbarButton } from '@/modules/status-center';
import CommandPaletteToolbarButton from '@/modules/extensions/components/command-palette-toolbar-button.vue';

export interface ToolbarWidgetDefinition {
  id: ToolbarWidgetId;
  labelKey: string;
  // Icon used for the edit-mode placeholder and the customize-sheet pool tile.
  icon: Component;
  // The real interactive component rendered inline in the toolbar (normal mode).
  component: Component;
}

// Single source of truth for the stateful toolbar widgets. Both the live toolbar
// and the customize sheet read from this list.
export const TOOLBAR_WIDGET_DEFINITIONS: ToolbarWidgetDefinition[] = [
  {
    id: 'commandPalette',
    labelKey: 'shortcuts.toggleCommandPalette',
    icon: CommandIcon,
    component: markRaw(CommandPaletteToolbarButton),
  },
  {
    id: 'globalSearch',
    labelKey: 'globalSearch.globalSearch',
    icon: SearchIcon,
    component: markRaw(GlobalSearchToolbarButton),
  },
  {
    id: 'lanShare',
    labelKey: 'lanShare.toolbarTooltip',
    icon: Share2Icon,
    component: markRaw(LanShareToolbarButton),
  },
  {
    id: 'statusCenter',
    labelKey: 'statusCenter.title',
    icon: ActivityIcon,
    component: markRaw(StatusCenterToolbarButton),
  },
];

const WIDGET_DEFINITIONS_BY_ID = new Map<ToolbarWidgetId, ToolbarWidgetDefinition>(
  TOOLBAR_WIDGET_DEFINITIONS.map(definition => [definition.id, definition]),
);

export function getToolbarWidgetDefinition(id: ToolbarWidgetId): ToolbarWidgetDefinition | undefined {
  return WIDGET_DEFINITIONS_BY_ID.get(id);
}

// Widget ids in the order they should be appended as defaults / on migration.
export const DEFAULT_TOOLBAR_WIDGET_IDS: ToolbarWidgetId[] = [
  'commandPalette',
  'globalSearch',
  'lanShare',
  'statusCenter',
];
