<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PencilIcon, CheckIcon, FolderPlusIcon } from '@lucide/vue';
import { Container, Draggable, type DropResult } from 'vue3-smooth-dnd';
import {
  DrivesSection,
  HomeBanner,
  HomeGroupSection,
} from '@/modules/home/components';
import { PageHomeLayout } from '@/layouts';
import { usePageDropZone } from '@/composables/use-page-drop-zone';
import { useFileDropOperation } from '@/composables/use-file-drop-operation';
import FileBrowserConflictDialog from '@/modules/navigator/components/file-browser/file-browser-conflict-dialog.vue';
import { getStaggerSlideUpBinding } from '@/utils/stagger-animation';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useHomeCustomize } from '@/modules/home/composables';
import { useHomeCustomizeStore } from '@/stores/runtime/home-customize';
import { Button } from '@/components/ui/button';

const dropContainerRef = ref<HTMLElement | null>(null);
const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const showHomeBanner = computed(() => userSettingsStore.userSettings.showHomeBanner);

const homeCustomizeStore = useHomeCustomizeStore();
const editing = computed(() => homeCustomizeStore.isEditMode);
const { groups, createGroup, reorderGroups, ensureInitialized } = useHomeCustomize();

function handleAddGroup() {
  void createGroup(t('home.newGroupTitle'));
}

function onGroupReorder(dropResult: DropResult) {
  void reorderGroups(dropResult.removedIndex, dropResult.addedIndex);
}

// Seed the default "User Directories" group on first run (migrates the legacy
// user-directories model + OS folders into the unified group list).
onMounted(() => {
  void ensureInitialized();
});

// Leaving the home page exits edit mode so the bars return to their normal,
// clickable state.
onUnmounted(() => {
  homeCustomizeStore.exitEditMode();
});

const {
  conflictDialogState,
  handleConflictResolution,
  handleConflictCancel,
  performDrop,
} = useFileDropOperation();

usePageDropZone({
  containerRef: dropContainerRef,
  onDrop: (sourcePaths, targetPath, operation) => {
    performDrop(sourcePaths, targetPath, operation);
  },
});
</script>

<template>
  <PageHomeLayout>
    <HomeBanner v-if="showHomeBanner" />

    <div
      ref="dropContainerRef"
      class="home-page__content"
      :class="{ 'home-page__content--without-banner': !showHomeBanner }"
    >
      <header
        class="home-page__header"
        :class="{ 'home-page__header--with-banner': showHomeBanner }"
      >
        <h1
          v-if="!showHomeBanner"
          class="home-page__title"
        >
          {{ t('pages.home') }}
        </h1>

        <div class="home-page__edit-controls">
          <Button
            v-if="editing"
            variant="outline"
            size="sm"
            @click="handleAddGroup"
          >
            <FolderPlusIcon :size="14" />
            {{ t('home.addGroup') }}
          </Button>
          <Button
            :variant="editing ? 'default' : 'outline'"
            size="sm"
            @click="homeCustomizeStore.toggleEditMode()"
          >
            <component
              :is="editing ? CheckIcon : PencilIcon"
              :size="14"
            />
            {{ editing ? t('home.doneEditing') : t('home.editLayout') }}
          </Button>
        </div>
      </header>

      <p
        v-if="editing"
        class="home-page__edit-hint"
      >
        {{ t('home.editLayoutHint') }}
      </p>

      <!-- Edit mode: groups are vertically draggable (via their header handle) so
           the user can reorder them, including the default "User Directories". -->
      <Container
        v-if="editing"
        orientation="vertical"
        lock-axis="y"
        drag-handle-selector=".home-group-section__drag-handle"
        drag-class="home-page__group--dragging"
        @drop="onGroupReorder"
      >
        <Draggable
          v-for="group in groups"
          :key="group.id"
        >
          <HomeGroupSection :group="group" />
        </Draggable>
      </Container>

      <template v-else>
        <HomeGroupSection
          v-for="(group, groupIndex) in groups"
          :key="group.id"
          v-bind="getStaggerSlideUpBinding(groupIndex, {initialDelayMs: 0, stepMs: 300})"
          :group="group"
        />
      </template>

      <DrivesSection v-bind="getStaggerSlideUpBinding(groups.length, {initialDelayMs: 0, stepMs: 300})" />
    </div>

    <FileBrowserConflictDialog
      v-model:open="conflictDialogState.isOpen"
      :conflicts="conflictDialogState.conflicts"
      :operation-type="conflictDialogState.operationType"
      :is-checking-conflicts="conflictDialogState.isCheckingConflicts"
      @resolve="handleConflictResolution"
      @cancel="handleConflictCancel"
    />
  </PageHomeLayout>
</template>

<style>
.home-page__content {
  display: flex;
  flex-direction: column;
  padding: 0 16px 24px;
  gap: 8px;
}

.home-page__content--without-banner {
  margin-top: 52px;
}

.home-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

/* With the banner there is no page title, so pin the edit controls to the
   right of the first row. */
.home-page__header--with-banner {
  justify-content: flex-end;
  min-height: 32px;
}

.home-page__title {
  color: hsl(var(--foreground));
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.home-page__edit-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.home-page__edit-hint {
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}
</style>
