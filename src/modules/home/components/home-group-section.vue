<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Container, Draggable, type DropResult } from 'vue3-smooth-dnd';
import { GripVerticalIcon, PencilIcon, PlusIcon, Trash2Icon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useHomeCustomize, type HomeDirDragPayload, type UserDirectory } from '@/modules/home/composables';
import { useHomeCustomizeStore, HOME_CUSTOMIZE_DRAG_GROUP } from '@/stores/runtime/home-customize';
import type { HomeGroup, HomeGroupItem } from '@/types/user-settings';
import { getStaggerSlideUpBinding } from '@/utils/stagger-animation';
import UserDirectoryCard from './user-directory-card.vue';
import HomeEditCard from './home-edit-card.vue';
import UserDirectoryEditorDialog from './user-directory-editor-dialog.vue';

const props = defineProps<{
  group: HomeGroup;
}>();

const { t } = useI18n();
const homeCustomizeStore = useHomeCustomizeStore();
const {
  resolveGroupTitle,
  renameGroup,
  deleteGroup,
  addItemToGroup,
  updateGroupItem,
  removeItemFromGroup,
  applyGroupDrop,
} = useHomeCustomize();

const editing = computed(() => homeCustomizeStore.isEditMode);

const groupTitle = computed(() =>
  resolveGroupTitle(props.group, t, t('home.newGroupTitle')),
);

// Map a group item onto the UserDirectory shape so both the tiles and the
// per-tile editor can reuse UserDirectoryCard / UserDirectoryEditorDialog.
function toUserDirectory(item: HomeGroupItem): UserDirectory {
  return {
    id: item.id,
    titleKey: item.titleKey,
    customTitle: item.title,
    iconName: item.icon || 'FolderIcon',
    customIconName: item.icon,
    path: item.path,
  };
}

function groupItemPayload(index: number): HomeDirDragPayload {
  return {
    source: 'group',
    groupId: props.group.id,
    item: props.group.items[index],
  };
}

function onDrop(dropResult: DropResult) {
  void applyGroupDrop(props.group.id, dropResult);
}

function onRenameInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  void renameGroup(props.group.id, value);
}

function handleDeleteGroup() {
  void deleteGroup(props.group.id);
}

function handleRemoveItem(itemId: string) {
  void removeItemFromGroup(props.group.id, itemId);
}

const isEditorOpen = ref(false);
const editingItem = ref<UserDirectory | null>(null);

function handleAddItem() {
  editingItem.value = {
    id: '',
    titleKey: undefined,
    customTitle: '',
    iconName: 'FolderIcon',
    customIconName: undefined,
    path: '',
  };
  isEditorOpen.value = true;
}

function handleEditItem(item: HomeGroupItem) {
  editingItem.value = toUserDirectory(item);
  isEditorOpen.value = true;
}

async function handleSaveItem(itemId: string, title: string, path: string, icon: string | undefined) {
  if (itemId) {
    await updateGroupItem(props.group.id, itemId, {
      path,
      title,
      icon,
    });
    return;
  }

  await addItemToGroup(props.group.id, {
    path,
    title,
    icon,
  });
}

async function handleDeleteItem(itemId: string) {
  await removeItemFromGroup(props.group.id, itemId);
}
</script>

<template>
  <section class="home-group-section">
    <div class="home-group-section__header">
      <span
        v-if="editing"
        class="home-group-section__drag-handle"
        :title="t('home.reorderGroup')"
      >
        <GripVerticalIcon :size="16" />
      </span>

      <input
        v-if="editing"
        class="home-group-section__title-input"
        :value="group.title ?? ''"
        :placeholder="groupTitle"
        @input="onRenameInput"
      >
      <h2
        v-else
        class="home-group-section__title"
      >
        {{ groupTitle }}
      </h2>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            class="home-group-section__add-button"
            variant="outline"
            size="xs"
            @click="handleAddItem"
          >
            <PlusIcon :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('add') }}</TooltipContent>
      </Tooltip>

      <Tooltip v-if="editing">
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="xs"
            @click="handleDeleteGroup"
          >
            <Trash2Icon :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('home.deleteGroup') }}</TooltipContent>
      </Tooltip>
    </div>

    <!-- Edit state: draggable tiles via smooth-dnd. -->
    <Container
      v-if="editing"
      class="home-group-section__grid"
      orientation="horizontal"
      :group-name="HOME_CUSTOMIZE_DRAG_GROUP"
      :get-child-payload="groupItemPayload"
      drag-class="home-group-section__chip--dragging"
      @drop="onDrop"
    >
      <Draggable
        v-for="item in group.items"
        :key="item.id"
      >
        <HomeEditCard
          removable
          editable
          @remove="handleRemoveItem(item.id)"
          @edit="handleEditItem(item)"
        >
          <UserDirectoryCard :directory="toUserDirectory(item)" />
        </HomeEditCard>
      </Draggable>
      <div
        v-if="group.items.length === 0"
        class="home-group-section__empty"
      >
        {{ t('home.emptyGroup') }}
      </div>
    </Container>

    <!-- Normal state. -->
    <div
      v-else-if="group.items.length > 0"
      class="home-group-section__grid"
    >
      <DirEntryInteractive
        v-for="(item, itemIndex) in group.items"
        :key="item.id"
        :path="item.path"
        :disable-destructive-actions="true"
      >
        <template #extra-items>
          <ContextMenuItem @select="handleEditItem(item)">
            <PencilIcon :size="16" />
            {{ t('contextMenus.dirItem.editCard') }}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </template>
        <UserDirectoryCard
          v-bind="getStaggerSlideUpBinding(itemIndex)"
          :directory="toUserDirectory(item)"
        />
      </DirEntryInteractive>
    </div>

    <UserDirectoryEditorDialog
      v-if="isEditorOpen"
      v-model:open="isEditorOpen"
      :directory="editingItem"
      @save="handleSaveItem"
      @delete="handleDeleteItem"
    />
  </section>
</template>

<style>
.home-group-section {
  margin-bottom: 16px;
}

.home-group-section__header {
  display: flex;
  align-items: center;
  min-height: 28px;
  margin-bottom: 12px;
  gap: 8px;
}

.home-group-section__drag-handle {
  display: flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
  cursor: grab;
}

.home-group-section__drag-handle:active {
  cursor: grabbing;
}

.home-group-section__title {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.home-group-section__title-input {
  min-width: 120px;
  max-width: 260px;
  padding: 4px 8px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
}

.home-group-section__title-input:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: 0;
}

/* Match the user-directories add button: hidden until the section is hovered. */
.home-group-section__add-button {
  opacity: 0;
  transition:
    opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.home-group-section:hover .home-group-section__add-button,
.home-group-section:focus-within .home-group-section__add-button {
  opacity: 1;
  transition:
    opacity var(--hover-transition-duration-in),
    background-color var(--hover-transition-duration-in),
    color var(--hover-transition-duration-in);
}

.home-group-section__grid {
  display: grid;
  gap: 16px;
  grid-auto-rows: 48px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.home-group-section__empty {
  display: flex;
  align-items: center;
  padding: 0 16px;
  border: 1px dashed hsl(var(--border));
  border-radius: var(--radius);
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  grid-column: 1 / -1;
}

/* Preserve the grid layout that smooth-dnd would otherwise override (it forces
   a table/inline-block layout on horizontal containers). */
.home-group-section__grid.smooth-dnd-container {
  display: grid !important;
}

.home-group-section__grid > .smooth-dnd-draggable-wrapper {
  height: 100%;
}

.home-group-section__chip--dragging {
  opacity: 0.9;
}

.home-group-section__grid .dir-entry-interactive {
  border-radius: var(--radius);
  transition:
    outline-color var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.home-group-section__grid .dir-entry-interactive[data-drag-over] {
  background-color: var(--drop-target-subtle-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
  transition:
    outline-color var(--hover-transition-duration-in),
    background-color var(--hover-transition-duration-in);
}
</style>
