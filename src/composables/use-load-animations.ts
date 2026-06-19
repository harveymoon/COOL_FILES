// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';

const LOAD_ANIMATIONS_ATTRIBUTE = 'data-load-animations';
const STAGGER_DURATION_CSS_VARIABLE = '--stagger-slide-up-duration';

export const LOAD_ANIMATIONS_DURATION_MIN_MS = 80;
export const LOAD_ANIMATIONS_DURATION_MAX_MS = 1200;
export const LOAD_ANIMATIONS_STAGGER_MIN_MS = 0;
export const LOAD_ANIMATIONS_STAGGER_MAX_MS = 200;

// Module-level reactive state so the plain `stagger-animation` helper (used in
// many components' setup) can read the current per-item cascade step without
// depending on the Pinia store directly.
const enabled = ref(true);
const durationMs = ref(440);
const staggerStepMs = ref(48);

export function getLoadAnimationsEnabled(): boolean {
  return enabled.value;
}

export function getLoadAnimationsStaggerStepMs(): number {
  return staggerStepMs.value;
}

function applyToDocument() {
  const root = document.documentElement;
  root.setAttribute(LOAD_ANIMATIONS_ATTRIBUTE, enabled.value ? 'on' : 'off');
  root.style.setProperty(STAGGER_DURATION_CSS_VARIABLE, `${durationMs.value}ms`);
}

export function useLoadAnimations() {
  function applyLoadAnimations(settings: {
    enabled: boolean;
    durationMs: number;
    staggerStepMs: number;
  }) {
    enabled.value = settings.enabled;
    durationMs.value = settings.durationMs;
    staggerStepMs.value = settings.staggerStepMs;
    applyToDocument();
  }

  return {
    enabled,
    durationMs,
    staggerStepMs,
    applyLoadAnimations,
  };
}
