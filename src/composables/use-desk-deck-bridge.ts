// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Frontend half of the Desk_Deck integration. The Rust module
// (`src-tauri/src/desk_deck`) exposes a local-only HTTP/WS API; inbound commands
// arrive here as `desk-deck-command` Tauri events and are mapped onto the
// navigator. Outbound state is pushed back via `desk_deck_publish_state` whenever
// it changes. See `DESK_DECK_INTEGRATION.md`.

import { watch, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface DeskDeckPlace {
  id: string;
  name: string;
  path: string;
  kind: 'pin' | 'drive' | 'network';
}

export interface DeskDeckState {
  current: string | null;
  currentName: string | null;
  layout: string | null;
  showHidden: boolean;
  selectionCount: number;
  places: DeskDeckPlace[];
}

export interface DeskDeckCommand {
  verb: string;
  value?: unknown;
}

const PUBLISH_DEBOUNCE_MS = 150;

export function useDeskDeckBridge(options: {
  onCommand: (command: DeskDeckCommand) => void | Promise<void>;
  state: () => DeskDeckState;
}) {
  let unlisten: UnlistenFn | null = null;
  let publishTimer: ReturnType<typeof setTimeout> | null = null;

  function publish() {
    void invoke('desk_deck_publish_state', { state: options.state() })
      .catch((error) => {
        console.error('Failed to publish Desk_Deck state:', error);
      });
  }

  function schedulePublish() {
    if (publishTimer) {
      clearTimeout(publishTimer);
    }

    publishTimer = setTimeout(() => {
      publishTimer = null;
      publish();
    }, PUBLISH_DEBOUNCE_MS);
  }

  onMounted(async () => {
    unlisten = await listen<DeskDeckCommand>('desk-deck-command', (event) => {
      void options.onCommand(event.payload);
    });

    // Seed the cache so the first GET /api/state / WS connect has real data.
    publish();
  });

  watch(options.state, schedulePublish, { deep: true });

  onUnmounted(() => {
    if (unlisten) {
      unlisten();
      unlisten = null;
    }

    if (publishTimer) {
      clearTimeout(publishTimer);
      publishTimer = null;
    }
  });
}
