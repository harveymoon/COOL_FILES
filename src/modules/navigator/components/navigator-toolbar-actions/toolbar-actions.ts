// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Component } from 'vue';
import {
  ListIcon,
  LayoutGridIcon,
  Columns3Icon,
  NetworkIcon,
  FlipHorizontalIcon,
  PanelRightIcon,
  FolderPlusIcon,
  FilePlusIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  HomeIcon,
  RotateCcwIcon,
  CopyIcon,
  ScissorsIcon,
  ClipboardPasteIcon,
  PencilIcon,
  Trash2Icon,
  EyeIcon,
  EyeOffIcon,
  TerminalSquareIcon,
  ScanEyeIcon,
  TextSearchIcon,
} from '@lucide/vue';
import type { ToolbarActionId } from '@/types/user-settings';

export type ToolbarActionGroup = 'layout' | 'view' | 'create' | 'navigation' | 'clipboard' | 'tools';

export interface ToolbarActionDefinition {
  id: ToolbarActionId;
  labelKey: string;
  icon: Component;
  group: ToolbarActionGroup;
}

// Single source of truth for every toolbar action. Both the live toolbar and the
// settings editor read from this list, so an action is defined exactly once.
export const TOOLBAR_ACTION_DEFINITIONS: ToolbarActionDefinition[] = [
  {
    id: 'layoutList',
    labelKey: 'list',
    icon: ListIcon,
    group: 'layout',
  },
  {
    id: 'layoutGrid',
    labelKey: 'grid',
    icon: LayoutGridIcon,
    group: 'layout',
  },
  {
    id: 'layoutColumns',
    labelKey: 'columns',
    icon: Columns3Icon,
    group: 'layout',
  },
  {
    id: 'layoutTree',
    labelKey: 'tree',
    icon: NetworkIcon,
    group: 'layout',
  },
  {
    id: 'splitView',
    labelKey: 'splitView',
    icon: FlipHorizontalIcon,
    group: 'view',
  },
  {
    id: 'infoPanel',
    labelKey: 'settings.infoPanel.title',
    icon: PanelRightIcon,
    group: 'view',
  },
  {
    id: 'toggleHiddenFiles',
    labelKey: 'filter.showHiddenItems',
    icon: EyeIcon,
    group: 'view',
  },
  {
    id: 'newFolder',
    labelKey: 'navigator.newDirectory',
    icon: FolderPlusIcon,
    group: 'create',
  },
  {
    id: 'newFile',
    labelKey: 'navigator.newFile',
    icon: FilePlusIcon,
    group: 'create',
  },
  {
    id: 'back',
    labelKey: 'shortcuts.navigateHistoryBack',
    icon: ArrowLeftIcon,
    group: 'navigation',
  },
  {
    id: 'forward',
    labelKey: 'shortcuts.navigateHistoryForward',
    icon: ArrowRightIcon,
    group: 'navigation',
  },
  {
    id: 'up',
    labelKey: 'shortcuts.goUpDirectory',
    icon: ArrowUpIcon,
    group: 'navigation',
  },
  {
    id: 'home',
    labelKey: 'pages.home',
    icon: HomeIcon,
    group: 'navigation',
  },
  {
    id: 'reload',
    labelKey: 'shortcuts.reloadCurrentDirectory',
    icon: RotateCcwIcon,
    group: 'navigation',
  },
  {
    id: 'copy',
    labelKey: 'fileBrowser.actions.copy',
    icon: CopyIcon,
    group: 'clipboard',
  },
  {
    id: 'cut',
    labelKey: 'fileBrowser.actions.cut',
    icon: ScissorsIcon,
    group: 'clipboard',
  },
  {
    id: 'paste',
    labelKey: 'fileBrowser.actions.paste',
    icon: ClipboardPasteIcon,
    group: 'clipboard',
  },
  {
    id: 'rename',
    labelKey: 'fileBrowser.actions.rename',
    icon: PencilIcon,
    group: 'clipboard',
  },
  {
    id: 'delete',
    labelKey: 'fileBrowser.actions.delete',
    icon: Trash2Icon,
    group: 'clipboard',
  },
  {
    id: 'openTerminal',
    labelKey: 'shortcuts.openCurrentDirInTerminal',
    icon: TerminalSquareIcon,
    group: 'tools',
  },
  {
    id: 'quickView',
    labelKey: 'fileBrowser.actions.quickView',
    icon: ScanEyeIcon,
    group: 'tools',
  },
  {
    id: 'toggleFilter',
    labelKey: 'filter.filter',
    icon: TextSearchIcon,
    group: 'tools',
  },
];

const DEFINITIONS_BY_ID = new Map<ToolbarActionId, ToolbarActionDefinition>(
  TOOLBAR_ACTION_DEFINITIONS.map(definition => [definition.id, definition]),
);

export function getToolbarActionDefinition(id: ToolbarActionId): ToolbarActionDefinition | undefined {
  return DEFINITIONS_BY_ID.get(id);
}

// Icon shown for the hidden-files action when hidden files are currently visible.
export const TOOLBAR_HIDDEN_FILES_ACTIVE_ICON = EyeOffIcon;

// Toolbar actions that map directly onto an existing shortcut handler (already
// registered in the navigator page). The toolbar dispatches these by id.
export const TOOLBAR_ACTION_SHORTCUT_MAP: Partial<Record<ToolbarActionId, string>> = {
  newFolder: 'createNewDirectory',
  newFile: 'createNewFile',
  back: 'navigateHistoryBack',
  forward: 'navigateHistoryForward',
  up: 'goUpDirectory',
  reload: 'reloadCurrentDirectory',
  copy: 'copy',
  cut: 'cut',
  paste: 'paste',
  rename: 'rename',
  delete: 'delete',
  openTerminal: 'openTerminal',
  quickView: 'quickView',
  toggleFilter: 'toggleFilter',
};
