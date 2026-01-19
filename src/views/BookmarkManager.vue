<script setup lang="ts">
import { onMounted } from 'vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import FileUploadPanel from '@/components/FileUploadPanel.vue'
import FileListPanel from '@/components/FileListPanel.vue'
import Toolbar from '@/components/Toolbar.vue'
import BookmarkTreeCanvas from '@/components/BookmarkTreeCanvas.vue'
// import BookmarkTree from '@/components/visualization/BookmarkTree.vue'
import DuplicateResolutionModal from '@/components/DuplicateResolutionModal.vue'
import EditBookmarkModal from '@/components/EditBookmarkModal.vue'
import ExportModal from '@/components/ExportModal.vue'
import TagManagementPanel from '@/components/TagManagementPanel.vue'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

onMounted(async () => {
  try {
    await bookmarkStore.initialize()
  } catch (error) {
    console.error('Failed to initialize bookmark manager:', error)
  }
})
</script>

<template>
  <a-layout class="bookmark-manager">
    <!-- Sidebar -->
    <a-layout-sider
      v-model:collapsed="uiStore.sidebarCollapsed"
      :width="300"
      :collapsed-width="0"
      breakpoint="lg"
      theme="light"
      class="sidebar"
    >
      <div class="sidebar-content">
        <FileUploadPanel />
        <a-divider />
        <FileListPanel />
      </div>
    </a-layout-sider>

    <!-- Main Content -->
    <a-layout>
      <a-layout-header class="header">
        <Toolbar />
      </a-layout-header>

      <a-layout-content class="content">
        <a-spin :spinning="bookmarkStore.isLoading" :tip="bookmarkStore.loadingMessage">
          <BookmarkTreeCanvas />
          <!-- <BookmarkTree /> -->
        </a-spin>
      </a-layout-content>

      <!-- Stats Footer -->
      <a-layout-footer class="footer">
        <a-space>
          <a-statistic
            title="Files"
            :value="bookmarkStore.stats.totalFiles"
            :value-style="{ fontSize: '14px' }"
          />
          <a-divider type="vertical" />
          <a-statistic
            title="Bookmarks"
            :value="bookmarkStore.stats.totalBookmarks"
            :value-style="{ fontSize: '14px' }"
          />
          <a-divider type="vertical" />
          <a-statistic
            title="Folders"
            :value="bookmarkStore.stats.totalFolders"
            :value-style="{ fontSize: '14px' }"
          />
          <a-divider type="vertical" />
          <a-statistic
            title="Duplicates"
            :value="bookmarkStore.stats.totalDuplicates"
            :value-style="{ fontSize: '14px', color: bookmarkStore.stats.totalDuplicates > 0 ? '#ff4d4f' : undefined }"
          />
          <a-divider type="vertical" />
          <a-statistic
            title="Tags"
            :value="bookmarkStore.stats.totalTags"
            :value-style="{ fontSize: '14px' }"
          />
        </a-space>
      </a-layout-footer>
    </a-layout>

    <!-- Modals -->
    <DuplicateResolutionModal />
    <EditBookmarkModal />
    <ExportModal />
    <TagManagementPanel />
  </a-layout>
</template>

<style scoped>
.bookmark-manager {
  height: 100vh;
  width: 100%;
}

.sidebar {
  background: #fff;
  border-right: 1px solid #f0f0f0;
}

.sidebar-content {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

.header {
  background: #fff;
  padding: 0 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  height: 64px;
}

.content {
  background: #f5f5f5;
  padding: 24px;
  overflow: auto;
  height: calc(100vh - 64px - 48px);
}

.footer {
  background: #fff;
  border-top: 1px solid #f0f0f0;
  padding: 8px 24px;
  height: 48px;
}
</style>
