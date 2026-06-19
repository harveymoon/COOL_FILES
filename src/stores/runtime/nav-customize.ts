// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';

// Shared smooth-dnd group so the real toolbar, the real sidebar, and the unused
// pool in the customize sheet can all exchange dragged items in edit mode.
export const NAV_CUSTOMIZE_DRAG_GROUP = 'cool-files-nav-customize';

export const useNavCustomizeStore = defineStore('navCustomize', () => {
  // When true, the real navigator toolbar and sidebar render in an editable
  // drag-drop state instead of their normal clickable state.
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
