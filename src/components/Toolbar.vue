<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import { message } from 'ant-design-vue'
import {
  SearchOutlined,
  UndoOutlined,
  RedoOutlined,
  ExportOutlined,
  PlusOutlined,
  FolderAddOutlined,
  TagsOutlined,
} from '@ant-design/icons-vue'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

// 检查是否处于编辑模式
// 全页模式和默认模式下：所有功能可用（编辑、删除、添加、拖拽、展开/收起）
// 全屏模式下：仅拖拽和展开/收起可用，编辑功能禁用
const isEditModeEnabled = computed(() => uiStore.contentViewMode !== 'fullscreen')

const searchValue = ref('')

const handleSearch = () => {
  if (searchValue.value.trim()) {
    bookmarkStore.search(searchValue.value)
  } else {
    bookmarkStore.clearSearch()
  }
}

const handleClearSearch = () => {
  searchValue.value = ''
  bookmarkStore.clearSearch()
}

const handleExport = () => {
  uiStore.showExportModal = true
}

const handleAddBookmark = () => {
  if (!isEditModeEnabled.value) {
    message.warning('添加功能在全屏模式下不可用，请先退出全屏模式')
    return
  }
  uiStore.showEditModal = true
  uiStore.editingNode = null
}

const handleAddFolder = () => {
  // TODO: Implement add folder modal
}

const handleManageTags = () => {
  uiStore.showTagPanel = true
}

const handleUndo = async () => {
  try {
    await bookmarkStore.undo()
  } catch (error) {
    console.error('Failed to undo:', error)
  }
}

const handleRedo = async () => {
  try {
    await bookmarkStore.redo()
  } catch (error) {
    console.error('Failed to redo:', error)
  }
}
</script>

<template>
  <div class="toolbar">
    <!-- Search -->
    <a-input-search
      v-model:value="searchValue"
      placeholder="Search bookmarks (use 'tag:name' for tag search)"
      style="width: 400px"
      @search="handleSearch"
      @clear="handleClearSearch"
      allow-clear
    >
      <template #prefix>
        <search-outlined />
      </template>
    </a-input-search>

    <a-space class="actions">
      <!-- Undo/Redo -->
      <a-button-group>
        <a-tooltip title="Undo">
          <a-button
            :disabled="!bookmarkStore.canUndo"
            @click="handleUndo"
          >
            <template #icon><undo-outlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="Redo">
          <a-button
            :disabled="!bookmarkStore.canRedo"
            @click="handleRedo"
          >
            <template #icon><redo-outlined /></template>
          </a-button>
        </a-tooltip>
      </a-button-group>

      <!-- Add Actions -->
      <a-dropdown>
        <a-button type="primary" :disabled="!isEditModeEnabled">
          <template #icon><plus-outlined /></template>
          Add
        </a-button>
        <template #overlay>
          <a-menu>
            <a-menu-item 
              key="bookmark" 
              :disabled="!isEditModeEnabled"
              @click="handleAddBookmark"
            >
              <plus-outlined />
              Add Bookmark
            </a-menu-item>
            <a-menu-item 
              key="folder" 
              :disabled="!isEditModeEnabled"
              @click="handleAddFolder"
            >
              <folder-add-outlined />
              Add Folder
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <!-- Tag Management -->
      <a-tooltip title="Manage Tags">
        <a-button @click="handleManageTags">
          <template #icon><tags-outlined /></template>
        </a-button>
      </a-tooltip>

      <!-- Export -->
      <a-tooltip title="Export Bookmarks">
        <a-button @click="handleExport">
          <template #icon><export-outlined /></template>
          Export
        </a-button>
      </a-tooltip>
    </a-space>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
