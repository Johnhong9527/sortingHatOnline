<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
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
import { FullscreenOutlined, ExpandOutlined, CompressOutlined, CloseOutlined } from '@ant-design/icons-vue'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

onMounted(async () => {
  try {
    await bookmarkStore.initialize()
  } catch (error) {
    console.error('Failed to initialize bookmark manager:', error)
  }

  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.addEventListener('mozfullscreenchange', handleFullscreenChange)
  document.addEventListener('MSFullscreenChange', handleFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
  document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
})

// 处理全屏状态变化
const handleFullscreenChange = () => {
  const isFullscreen = !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  )

  if (!isFullscreen && uiStore.contentViewMode === 'fullscreen') {
    uiStore.setContentViewMode('normal')
  }
}

// 检查是否处于全屏状态
const isFullscreen = () => {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  )
}

// 进入全屏模式
const enterFullscreen = async () => {
  const contentElement = document.querySelector('.content') as HTMLElement
  if (!contentElement) return

  try {
    if (contentElement.requestFullscreen) {
      await contentElement.requestFullscreen()
    } else if ((contentElement as any).webkitRequestFullscreen) {
      await (contentElement as any).webkitRequestFullscreen()
    } else if ((contentElement as any).mozRequestFullScreen) {
      await (contentElement as any).mozRequestFullScreen()
    } else if ((contentElement as any).msRequestFullscreen) {
      await (contentElement as any).msRequestFullscreen()
    }
    uiStore.setContentViewMode('fullscreen')
  } catch (error) {
    console.error('Failed to enter fullscreen:', error)
  }
}

// 退出全屏模式
const exitFullscreen = async () => {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen()
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen()
    } else if ((document as any).mozCancelFullScreen) {
      await (document as any).mozCancelFullScreen()
    } else if ((document as any).msExitFullscreen) {
      await (document as any).msExitFullscreen()
    }
    uiStore.setContentViewMode('normal')
  } catch (error) {
    console.error('Failed to exit fullscreen:', error)
  }
}

// 切换全屏模式
const toggleFullscreen = async () => {
  if (isFullscreen()) {
    await exitFullscreen()
  } else {
    await enterFullscreen()
  }
}

// 切换全页模式
const toggleFullpage = () => {
  if (uiStore.contentViewMode === 'fullpage') {
    uiStore.setContentViewMode('normal')
  } else {
    uiStore.setContentViewMode('fullpage')
  }
}

// 退出视图模式（重置为普通模式）
const exitViewMode = async () => {
  // 如果处于全屏模式，先退出全屏
  if (isFullscreen()) {
    await exitFullscreen()
  } else {
    // 否则重置为普通模式
    uiStore.setContentViewMode('normal')
  }
}

// 视图功能独立，不再监听编辑模式关闭
</script>

<template>
  <a-layout 
    class="bookmark-manager"
    :class="{
      'fullpage-mode': uiStore.contentViewMode === 'fullpage',
      'fullscreen-mode': uiStore.contentViewMode === 'fullscreen'
    }"
  >
    <!-- Sidebar -->
    <a-layout-sider
      v-model:collapsed="uiStore.sidebarCollapsed"
      :width="300"
      :collapsed-width="0"
      breakpoint="lg"
      theme="light"
      class="sidebar"
      :class="{ 'hidden-in-fullpage': uiStore.contentViewMode === 'fullpage' || uiStore.contentViewMode === 'fullscreen' }"
    >
      <div class="sidebar-content">
        <FileUploadPanel />
        <a-divider />
        <FileListPanel />
      </div>
    </a-layout-sider>

    <!-- Main Content -->
    <a-layout>
      <a-layout-header 
        class="header"
        :class="{ 'hidden-in-fullpage': uiStore.contentViewMode === 'fullpage' || uiStore.contentViewMode === 'fullscreen' }"
      >
        <Toolbar />
      </a-layout-header>

      <a-layout-content class="content">
        <!-- 视图控制按钮组 - 独立功能，始终可用 -->
        <div class="view-control-buttons">
          <a-tooltip title="占据整个网页">
            <a-button
              :type="uiStore.contentViewMode === 'fullpage' ? 'primary' : 'text'"
              @click="toggleFullpage"
            >
              <template #icon>
                <expand-outlined v-if="uiStore.contentViewMode !== 'fullpage'" />
                <compress-outlined v-else />
              </template>
            </a-button>
          </a-tooltip>
          <a-tooltip :title="isFullscreen() ? '退出全屏' : '占据整个屏幕'">
            <a-button
              :type="uiStore.contentViewMode === 'fullscreen' ? 'primary' : 'text'"
              @click="toggleFullscreen"
            >
              <template #icon>
                <fullscreen-outlined v-if="!isFullscreen()" />
                <compress-outlined v-else />
              </template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="退出视图模式">
            <a-button
              type="text"
              @click="exitViewMode"
              :disabled="uiStore.contentViewMode === 'normal'"
            >
              <template #icon>
                <close-outlined />
              </template>
            </a-button>
          </a-tooltip>
        </div>

        <a-spin :spinning="bookmarkStore.isLoading" :tip="bookmarkStore.loadingMessage">
          <BookmarkTreeCanvas />
          <!-- <BookmarkTree /> -->
        </a-spin>
      </a-layout-content>

      <!-- Stats Footer -->
      <a-layout-footer 
        class="footer"
        :class="{ 'hidden-in-fullpage': uiStore.contentViewMode === 'fullpage' || uiStore.contentViewMode === 'fullscreen' }"
      >
        <a-space>
          <a-statistic
            title="文件"
            :value="bookmarkStore.stats.totalFiles"
            :value-style="{ fontSize: '14px' }"
          />
          <a-divider type="vertical" />
          <a-statistic
            title="书签"
            :value="bookmarkStore.stats.totalBookmarks"
            :value-style="{ fontSize: '14px' }"
          />
          <a-divider type="vertical" />
          <a-statistic
            title="文件夹"
            :value="bookmarkStore.stats.totalFolders"
            :value-style="{ fontSize: '14px' }"
          />
          <a-divider type="vertical" />
          <a-statistic
            title="重复项"
            :value="bookmarkStore.stats.totalDuplicates"
            :value-style="{ fontSize: '14px', color: bookmarkStore.stats.totalDuplicates > 0 ? '#ff4d4f' : undefined }"
          />
          <a-divider type="vertical" />
          <a-statistic
            title="标签"
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
  position: relative;
}

/* 全页模式样式 */
.bookmark-manager.fullpage-mode .content {
  height: 100vh;
  padding: 24px;
}

.bookmark-manager.fullpage-mode .hidden-in-fullpage {
  display: none !important;
}

/* 全屏模式样式 */
.bookmark-manager.fullscreen-mode .content {
  height: 100vh;
  padding: 24px;
}

.bookmark-manager.fullscreen-mode .hidden-in-fullpage {
  display: none !important;
}

/* 视图控制按钮组 */
.view-control-buttons {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 100;
  display: flex;
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.footer {
  background: #fff;
  border-top: 1px solid #f0f0f0;
  padding: 8px 24px;
  height: 48px;
}
</style>
