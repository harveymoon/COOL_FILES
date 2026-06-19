// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';

// Shared smooth-dnd group for directory tiles: the user-directories section and
// every custom group use it, so tiles can be reordered within a section and
// dragged across sections (user directories <-> custom groups).
export const HOME_CUSTOMIZE_DRAG_GROUP = 'cool-files-home-customize-dirs';

// Separate drag group for drives so they can only be reordered among themselves
// (drives are auto-discovered hardware: movable, not removable, not droppable
// into directory groups).
export const HOME_CUSTOMIZE_DRIVES_DRAG_GROUP = 'cool-files-home-customize-drives';

export const useHomeCustomizeStore = defineStore('homeCustomize', () => {
  // When true, the home page sections render in an editable drag-drop state
  // instead of their normal clickable state.
  const isEditMode = ref(false);

  function enterEditMode() {
    isEditMode.value = true;
  }

  function exitEditMode() {
    isEditMode.value = false;
  }

  function toggleEditMode() {
    isEditMode.value = !isEditMode.value;
  }

  return {
    isEditMode,
    enterEditMode,
    exitEditMode,
    toggleEditMode,
  };
});
