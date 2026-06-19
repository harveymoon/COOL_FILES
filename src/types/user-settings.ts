// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

type NestedPaths<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? T[K] extends unknown[]
      ? K
      : K | `${K}.${NestedPaths<T[K]>}`
    : K
  : never;

type GetNestedValue<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? GetNestedValue<T[K], Rest>
      : never
    : never;

export type UserSettingsPath = NestedPaths<UserSettings>;

export type UserSettingsValue<P extends UserSettingsPath> = GetNestedValue<UserSettings, P>;

export type HomeBannerPosition = {
  positionX: number;
  positionY: number;
  zoom: number;
};

export type HomeBannerPositions = Record<string, HomeBannerPosition>;

export type CustomBackgroundMediaItem = {
  path: string;
  id: string;
};

export type CustomBackgroundMedia = CustomBackgroundMediaItem[];

export type UserDirectoryCustomization = {
  title?: string;
  path?: string;
  icon?: string;
  deleted?: boolean;
};

export type UserDirectoriesCustomizations = Record<string, UserDirectoryCustomization>;

// A single directory tile inside a home group. `titleKey` localizes seeded
// built-in tiles (e.g. Desktop); `title` is an explicit user override.
export type HomeGroupItem = {
  id: string;
  path: string;
  title?: string;
  titleKey?: string;
  icon?: string;
};

// A section on the home page, holding its own directory tiles. Since the full
// merge, the default "User Directories" section is just a group like any other
// (its localized name comes from `titleKey`; `title` is a user rename override).
export type HomeGroup = {
  id: string;
  title?: string;
  titleKey?: string;
  items: HomeGroupItem[];
};

// Home-page layout customizations driven by the home edit mode.
// `drivesOrder` holds drive display order as a path list; paths not present fall
// back to natural order and are appended after. `initialized` gates the one-time
// seed of the default group (from the legacy `userDirectories` model + OS dirs).
// `userDirectoriesOrder` is legacy, retained only for that one-time migration.
export type HomeCustomizations = {
  groups: HomeGroup[];
  initialized: boolean;
  userDirectoriesOrder: string[];
  drivesOrder: string[];
};

export type MixBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export type InfusionPageSettings = {
  blur: number;
  mediaContrast: number;
  mediaBrightness: number;
  opacity: number;
  noise: number;
  noiseScale: number;
  mixBlendMode: MixBlendMode;
  background: {
    type: 'image' | 'video';
    path: string;
    index: number;
    mediaId?: string;
  };
};

export type InfusionPage = '' | 'home' | 'navigator' | 'dashboard' | 'settings' | 'extensions';

export type InfusionSettings = {
  enabled: boolean;
  sameSettingsForAllPages: boolean;
  selectedPageToCustomize: InfusionPage;
  pauseVideoWhenIdle: boolean;
  pages: Record<InfusionPage, InfusionPageSettings>;
};

export type VisualFiltersSettings = {
  brightness: number;
  contrast: number;
  dialogOverlayBlur: number;
};

export type ShortcutKeys = {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  key: string;
};

export type UserShortcutStoredValue = ShortcutKeys | Array<ShortcutKeys | null>;

export type ShortcutId
  = 'toggleGlobalSearch'
    | 'switchToHomePage'
    | 'switchToNavigatorPage'
    | 'switchToDashboardPage'
    | 'switchToSettingsPage'
    | 'switchToExtensionsPage'
    | 'navigatePageBack'
    | 'navigatePageForward'
    | 'toggleFilter'
    | 'toggleSettingsSearch'
    | 'toggleCommandPalette'
    | 'toggleAddressBar'
    | 'openEntry'
    | 'toggleSplitView'
    | 'createNewFile'
    | 'createNewDirectory'
    | 'copyCurrentDirectoryPath'
    | 'openCopiedPath'
    | 'copy'
    | 'cut'
    | 'paste'
    | 'selectAll'
    | 'delete'
    | 'deletePermanently'
    | 'rename'
    | 'escape'
    | 'quickView'
    | 'print'
    | 'openNewTab'
    | 'closeCurrentTab'
    | 'restoreLastClosedTab'
    | 'openTerminal'
    | 'openTerminalAdmin'
    | 'navigateUp'
    | 'navigateDown'
    | 'navigateLeft'
    | 'navigateRight'
    | 'openSelected'
    | 'navigateHistoryBack'
    | 'navigateHistoryForward'
    | 'goUpDirectory'
    | 'switchToLeftPane'
    | 'switchToRightPane'
    | 'setLayoutList'
    | 'setLayoutGrid'
    | 'setLayoutColumns'
    | 'reloadCurrentDirectory'
    | 'uiZoomIncrease'
    | 'uiZoomDecrease'
    | 'toggleFullscreen';

export type UserShortcuts = Partial<Record<ShortcutId, UserShortcutStoredValue>>;

export type ShortcutUserAlternateChordSlots = Partial<Record<ShortcutId, number[]>>;

export type GlobalShortcutId = 'launchApp';

export type UserGlobalShortcuts = Partial<Record<GlobalShortcutId, string>>;

export type AppUpdatesSettings = {
  autoCheck: boolean;
  lastCheckTimestamp: number;
};

export type ChangelogSettings = {
  showOnUpdate: boolean;
  lastSeenVersion: string;
};

export type TextSettings = {
  font: string;
};

export type LoadAnimationsSettings = {
  enabled: boolean;
  durationMs: number;
  staggerStepMs: number;
};

export type UserSettings = {
  language: LocalizationLanguage;
  theme: Theme;
  text: TextSettings;
  transparentToolbars: boolean;
  dateTime: DateTime;
  navigator: UserSettingsNavigator;
  globalSearch: UserSettingsGlobalSearch;
  UIZoomLevel?: number;
  showHomeBanner: boolean;
  homeBannerIndex: number;
  homeBannerMediaId: string;
  homeBannerPauseVideoWhenIdle: boolean;
  customBackgroundMedia: CustomBackgroundMedia;
  homeBannerPositions: HomeBannerPositions;
  driveCard: DriveCardSettings;
  userDirectories: UserDirectoriesCustomizations;
  home: HomeCustomizations;
  infusion: InfusionSettings;
  visualFilters: VisualFiltersSettings;
  settingsCurrentTab: string;
  shortcuts?: UserShortcuts;
  shortcutUserAlternateChordSlots?: ShortcutUserAlternateChordSlots;
  globalShortcuts?: UserGlobalShortcuts;
  focusWindowOnDriveConnected: boolean;
  preventDropdownCloseFocusReturn: boolean;
  quickAccessOnHover: boolean;
  tooltipDelayMs: number;
  launchAtStartup: boolean;
  launchAtStartupHidden: boolean;
  appUpdates: AppUpdatesSettings;
  changelog: ChangelogSettings;
  loadAnimations: LoadAnimationsSettings;
};

export type UserSettingsGlobalSearch = {
  scanDepth: number;
  autoScanPeriodMinutes: number;
  autoReindexWhenIdle: boolean;
  ignoredPaths: string[];
  selectedDriveRoots: string[];
  parallelScan: boolean;
  resultLimit: number;
  includeFiles: boolean;
  includeDirectories: boolean;
  exactMatch: boolean;
  typoTolerance: boolean;
  lastManualCancelTime: number | null;
};

export type DriveSpaceIndicatorStyle = 'linearVertical' | 'linearHorizontal' | 'linearHorizontalCentered' | 'circular';

export type DriveCardSettings = {
  showSpaceIndicator: boolean;
  spaceIndicatorStyle: DriveSpaceIndicatorStyle;
};

export type LocalizationLanguage = {
  name: string;
  locale: string;
  isCorrected: boolean;
  isRtl: boolean;
};

export type BuiltinThemeId = 'light' | 'dark' | 'system';
export type Theme = BuiltinThemeId | `extension:${string}:${string}`;
export type NavigatorIconTheme = string;

export type DateTime = {
  month: 'numeric' | 'short' | 'long';
  regionalFormat: {
    code: string;
    name: string;
  };
  autoDetectRegionalFormat: boolean;
  hour12: boolean;
  showRelativeDates: boolean;
  properties: {
    showSeconds: boolean;
    showMilliseconds: boolean;
  };
};

export type ListColumnVisibility = {
  type: boolean;
  items: boolean;
  size: boolean;
  modified: boolean;
  created: boolean;
  tags: boolean;
};

export type ListSortColumn = 'name' | 'type' | 'items' | 'size' | 'modified' | 'created' | 'tags';

// Per-column pixel widths for the list layout, keyed by column. Set when the
// user drags a column's resize handle in the list header.
export type ListColumnWidths = Record<ListSortColumn, number>;

export type ListSortDirection = 'asc' | 'desc';

export type LastTabCloseBehavior = 'createDefaultTab' | 'closeWindow' | 'navigateToHomePage';

export type UserSettingsNavigator = {
  lastTabCloseBehavior: LastTabCloseBehavior;
  boldActiveTabTitle: boolean;
  layout: NavigatorLayout;
  infoPanel: UserSettingsNavigatorInfoPanel;
  showHiddenFiles: boolean;
  folderIconTheme: NavigatorIconTheme;
  fileIconTheme: NavigatorIconTheme;
  listColumnVisibility: ListColumnVisibility;
  listColumnWidths: ListColumnWidths;
  listSortColumn: ListSortColumn | null;
  listSortDirection: ListSortDirection;
  toolbar: NavigatorToolbarSettings;
  sidebar: NavigatorSidebarSettings;
};

export type UserSettingsNavigatorInfoPanel = {
  show: boolean;
  // Width in px of the desktop info panel. Clamped to [INFO_PANEL_MIN_WIDTH,
  // INFO_PANEL_MAX_WIDTH] when the user drags the resize handle.
  width: number;
};

export type ToolbarActionId
  = 'layoutList'
    | 'layoutGrid'
    | 'layoutColumns'
    | 'splitView'
    | 'infoPanel'
    | 'newFolder'
    | 'newFile'
    | 'back'
    | 'forward'
    | 'up'
    | 'home'
    | 'reload'
    | 'copy'
    | 'cut'
    | 'paste'
    | 'rename'
    | 'delete'
    | 'toggleHiddenFiles'
    | 'openTerminal'
    | 'quickView'
    | 'toggleFilter';

// Stateful toolbar "widgets" are real interactive components (command palette,
// global search, LAN share, status center) rendered inline among the simple
// icon-actions. They keep their own popovers/state.
export type ToolbarWidgetId
  = 'commandPalette'
    | 'globalSearch'
    | 'lanShare'
    | 'statusCenter';

export type ToolbarItem
  = {
    kind: 'action';
    id: ToolbarActionId;
  }
  | {
    kind: 'widget';
    id: ToolbarWidgetId;
  }
  | { kind: 'separator' };

export type NavigatorToolbarSettings = {
  items: ToolbarItem[];
};

export type SidebarRouteId = 'home' | 'navigator' | 'dashboard' | 'settings' | 'extensions';

export type SidebarItem = {
  id: SidebarRouteId;
  visible: boolean;
};

export type NavigatorSidebarSettings = {
  items: SidebarItem[];
  // When true (default) discovered drives are auto-listed in the bottom area.
  // When false, only the user's explicit pins appear there.
  autoShowDrives: boolean;
  // Explicit drive/folder paths pinned to the bottom area, in display order.
  // Path-keyed so identity survives reconnects.
  pinnedPaths: string[];
};

export type NavigatorLayout = {
  type: {
    title: 'compactListLayout' | 'listLayout' | 'gridLayout' | 'columnsLayout';
    name: 'compact-list' | 'list' | 'grid' | 'columns';
  };
  dirItemOptions: {
    title: {
      height: number;
    };
    directory: {
      height: number;
    };
    file: {
      height: number;
    };
  };
};
