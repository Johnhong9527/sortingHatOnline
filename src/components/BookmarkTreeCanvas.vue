<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import { useCanvasTree } from '@/composables/useCanvasTree'
import type { BookmarkNode } from '@/utils/wasmBridge'
import { EditOutlined, DeleteOutlined, LinkOutlined, TagsOutlined, FolderOutlined, PlusOutlined, EyeOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()
const containerRef = ref<HTMLElement | null>(null)
const selectedNode = ref<BookmarkNode | null>(null)
const showDetailPanel = ref(false)

// Context menu state
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null as BookmarkNode | null
})

const treeData = computed(() => bookmarkStore.currentTree)
const expandedNodes = computed(() => uiStore.expandedNodes)
const searchResults = computed(() => new Set(bookmarkStore.searchResults))

// 检查是否处于编辑模式
// 全页模式和默认模式下：所有功能可用（编辑、删除、添加、拖拽、展开/收起）
// 全屏模式下：仅拖拽和展开/收起可用，编辑功能禁用
const isEditModeEnabled = computed(() => uiStore.contentViewMode !== 'fullscreen')

// Compute folder statistics
const folderStats = computed(() => {
  if (!selectedNode.value || selectedNode.value.url) return null

  // Flatten tree to get all nodes
  const flattenTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
    const result: BookmarkNode[] = []
    for (const node of nodes) {
      result.push(node)
      if (node.children) {
        result.push(...flattenTree(node.children))
      }
    }
    return result
  }

  const nodes = flattenTree(treeData.value)
  const folderId = selectedNode.value.id

  // Count direct children
  const directChildren = nodes.filter(n => n.parentId === folderId)
  const childBookmarks = directChildren.filter(n => n.url).length
  const childFolders = directChildren.filter(n => !n.url).length

  // Count all descendants recursively
  const getAllDescendants = (nodeId: string): BookmarkNode[] => {
    const children = nodes.filter(n => n.parentId === nodeId)
    const descendants = [...children]
    children.forEach(child => {
      descendants.push(...getAllDescendants(child.id))
    })
    return descendants
  }

  const allDescendants = getAllDescendants(folderId)
  const totalBookmarks = allDescendants.filter(n => n.url).length
  const totalFolders = allDescendants.filter(n => !n.url).length

  return {
    directChildren: directChildren.length,
    childBookmarks,
    childFolders,
    totalBookmarks,
    totalFolders,
    totalDescendants: allDescendants.length
  }
})

// Handle node click
// 展开/收起功能在所有模式下都可用（默认模式、全页模式、全屏模式）
const handleNodeClick = (node: BookmarkNode, _event: MouseEvent) => {
  console.log('🖱️ Node clicked:', node.title, 'isFolder:', !node.url)
  // If folder, toggle expansion (在所有模式下都可用)
  if (!node.url) {
    console.log('📂 Toggling folder expansion for:', node.id)
    console.log('📊 Before toggle, expandedNodes size:', expandedNodes.value.size)
    uiStore.toggleNodeExpansion(node.id)
    console.log('📊 After toggle, expandedNodes size:', expandedNodes.value.size)
    console.log('📊 Is expanded?', expandedNodes.value.has(node.id))
  } else {
    // If bookmark, show details (在所有模式下都可用)
    selectedNode.value = node
    showDetailPanel.value = true
  }
}

// Handle node right click
const handleNodeRightClick = (node: BookmarkNode, event: MouseEvent) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    node: node
  }
}

// Close context menu
const closeContextMenu = () => {
  contextMenu.value.visible = false
  contextMenu.value.node = null
}

// Handle context menu actions
const handleContextMenuAction = (action: 'edit' | 'delete' | 'rename' | 'addChild' | 'addSibling' | 'viewDetails' | 'toggleExpand') => {
  const node = contextMenu.value.node
  if (!node) return

  // 编辑相关操作在全屏模式下不可用
  // 注意：展开/收起（toggleExpand）和查看详情（viewDetails）在所有模式下都可用
  const editActions = ['edit', 'delete', 'rename', 'addChild', 'addSibling']
  if (editActions.includes(action) && !isEditModeEnabled.value) {
    message.warning('编辑功能在全屏模式下不可用，请先退出全屏模式')
    closeContextMenu()
    return
  }

  closeContextMenu()

  switch (action) {
    case 'edit':
      uiStore.openEditBookmark(node)
      break
    case 'delete':
      Modal.confirm({
        title: '删除节点',
        content: `确定要删除 "${node.title}" 吗？`,
        okText: '删除',
        okType: 'danger',
        onOk: async () => {
          try {
            await bookmarkStore.deleteBookmark(node.id)
            message.success('节点删除成功')
          } catch (error) {
            message.error(`删除失败: ${error}`)
          }
        }
      })
      break
    case 'rename':
      uiStore.openEditBookmark(node)
      break
    case 'addChild':
      // 添加子节点 - 只有目录节点才能添加子节点
      if (node.url) {
        message.warning('书签节点不能添加子节点，请选择目录节点')
        return
      }
      uiStore.openAddBookmark(node.id)
      break
    case 'addSibling':
      // 添加同级节点 - 使用父节点ID
      const parentId = node.parentId || 'root'
      uiStore.openAddBookmark(parentId)
      break
    case 'viewDetails':
      // 查看详情 - 设置选中节点并打开详情面板
      selectedNode.value = node
      showDetailPanel.value = true
      break
    case 'toggleExpand':
      // 展开/收起节点
      uiStore.toggleNodeExpansion(node.id)
      break
  }
}

// Handle node move
const handleNodeMove = async (nodeId: string, targetId: string, position?: 'before' | 'after' | 'inside') => {
  try {
    if (position === 'inside') {
      // Move into folder
      await bookmarkStore.moveNode(nodeId, targetId)
    } else if (position === 'before' || position === 'after') {
      // Move before/after sibling
      await bookmarkStore.moveNodeRelative(nodeId, targetId, position)
    } else {
      // Default: move into folder
      await bookmarkStore.moveNode(nodeId, targetId)
    }
    message.success('节点移动成功')
  } catch (error) {
    message.error(`移动节点失败: ${error}`)
    throw error
  }
}

// Initialize Canvas tree
const { resizeCanvas } = useCanvasTree(
  containerRef,
  treeData,
  expandedNodes,
  searchResults,
  handleNodeClick,
  handleNodeRightClick,
  handleNodeMove,
  (nodeIds: string[]) => uiStore.expandAll(nodeIds)
)

// 监听视图模式变化，在全页模式下重新计算 canvas 大小
watch(() => uiStore.contentViewMode, async (newMode) => {
  if (newMode === 'fullpage' || newMode === 'normal') {
    // 等待 DOM 更新完成
    await nextTick()
    // 延迟一点时间确保布局已完成
    setTimeout(() => {
      if (containerRef.value) {
        // 重新调整 canvas 大小以匹配容器
        resizeCanvas()
      }
    }, 100)
  }
})

// Handle edit
const handleEdit = () => {
  if (!isEditModeEnabled.value) {
    message.warning('编辑功能在全屏模式下不可用，请先退出全屏模式')
    return
  }
  if (selectedNode.value) {
    uiStore.editingNode = selectedNode.value
    uiStore.showEditModal = true
  }
}

// Handle delete
const handleDelete = () => {
  if (!isEditModeEnabled.value) {
    message.warning('删除功能在全屏模式下不可用，请先退出全屏模式')
    return
  }
  if (!selectedNode.value) return

  Modal.confirm({
    title: '删除节点',
    content: `确定要删除 "${selectedNode.value.title}" 吗？`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await bookmarkStore.deleteBookmark(selectedNode.value!.id)
        message.success('节点删除成功')
        showDetailPanel.value = false
        selectedNode.value = null
      } catch (error) {
        message.error(`删除失败: ${error}`)
      }
    },
  })
}

// Handle open URL
const handleOpenUrl = () => {
  if (selectedNode.value?.url) {
    window.open(selectedNode.value.url, '_blank')
  }
}

// Format date
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}
</script>

<template>
  <div class="bookmark-tree-canvas">
    <div class="content-wrapper">
      <div
        v-if="treeData.length > 0"
        ref="containerRef"
        class="tree-container"
        @click="closeContextMenu"
      />
      <a-empty
        v-else
        description="没有可显示的书签。上传文件以开始使用。"
        :image-style="{ height: '200px' }"
      />

      <!-- Context Menu -->
      <div
        v-if="contextMenu.visible"
        :style="{
          position: 'fixed',
          left: contextMenu.x + 'px',
          top: contextMenu.y + 'px',
          zIndex: 1000
        }"
        class="context-menu"
      >
        <!-- 查看详情 -->
        <div class="context-menu-item" @click="handleContextMenuAction('viewDetails')">
          <eye-outlined /> 查看详情
        </div>
        
        <!-- 添加子节点 (仅目录节点) -->
        <div 
          v-if="contextMenu.node && !contextMenu.node.url" 
          class="context-menu-item" 
          :class="{ 'disabled': !isEditModeEnabled }"
          @click="handleContextMenuAction('addChild')"
        >
          <plus-outlined /> 添加子节点
        </div>
        
        <!-- 添加同级节点 -->
        <div 
          class="context-menu-item" 
          :class="{ 'disabled': !isEditModeEnabled }"
          @click="handleContextMenuAction('addSibling')"
        >
          <plus-outlined /> 添加同级节点
        </div>
        
        <!-- 展开/收起 (仅目录节点) -->
        <div 
          v-if="contextMenu.node && !contextMenu.node.url" 
          class="context-menu-item" 
          @click="handleContextMenuAction('toggleExpand')"
        >
          <expand-outlined v-if="contextMenu.node && !expandedNodes.has(contextMenu.node.id)" />
          <compress-outlined v-else-if="contextMenu.node" />
          {{ contextMenu.node && expandedNodes.has(contextMenu.node.id) ? '收起' : '展开' }}
        </div>
        
        <!-- 分隔线 -->
        <div class="context-menu-divider"></div>
        
        <!-- 编辑 -->
        <div 
          class="context-menu-item" 
          :class="{ 'disabled': !isEditModeEnabled }"
          @click="handleContextMenuAction('edit')"
        >
          <edit-outlined /> 编辑
        </div>
        
        <!-- 删除 -->
        <div 
          class="context-menu-item danger" 
          :class="{ 'disabled': !isEditModeEnabled }"
          @click="handleContextMenuAction('delete')"
        >
          <delete-outlined /> 删除
        </div>
      </div>

      <!-- Legend -->
      <div v-if="treeData.length > 0" class="legend">
        <div class="legend-title">图例</div>
        <div class="legend-items">
          <div class="legend-item">
            <div class="legend-circle" style="background: #86efac; border-color: #22c55e;"></div>
            <span>文件夹</span>
          </div>
          <div class="legend-item">
            <div class="legend-circle" style="background: #e0e7ff; border-color: #6366f1;"></div>
            <span>书签</span>
          </div>
          <div class="legend-item">
            <div class="legend-circle" style="background: #bfdbfe; border-color: #3b82f6;"></div>
            <span>已标记</span>
          </div>
          <div class="legend-item">
            <div class="legend-circle" style="background: #fef3c7; border-color: #f59e0b;"></div>
            <span>重复项</span>
          </div>
          <div class="legend-item">
            <div class="legend-circle" style="background: #fef08a; border-color: #eab308; border-width: 3px;"></div>
            <span>搜索结果</span>
          </div>
        </div>
        <div class="legend-tips">
          <div>点击文件夹展开/收起</div>
          <div>点击书签查看详情</div>
          <div>右键点击显示菜单</div>
          <div>拖拽移动节点</div>
          <div>按住空格键 + 拖拽平移</div>
          <div>滚动缩放</div>
        </div>
      </div>

      <!-- Detail Panel -->
      <a-drawer
        v-model:open="showDetailPanel"
        title="节点详情"
        placement="right"
        width="400"
      >
        <div v-if="selectedNode" class="detail-panel">
          <!-- Title -->
          <div class="detail-section">
            <h3>
              <folder-outlined v-if="!selectedNode.url" />
              <link-outlined v-else />
              {{ selectedNode.title }}
            </h3>
          </div>

          <!-- URL -->
          <div v-if="selectedNode.url" class="detail-section">
            <label>URL</label>
            <a-input :value="selectedNode.url" readonly>
              <template #addonAfter>
                <a-button type="link" size="small" @click="handleOpenUrl">
                  <link-outlined />
                </a-button>
              </template>
            </a-input>
          </div>

          <!-- Folder Statistics -->
          <div v-if="!selectedNode.url && folderStats" class="detail-section">
            <label>文件夹内容</label>
            <a-space direction="vertical" style="width: 100%">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-statistic title="直接子项" :value="folderStats.directChildren">
                    <template #prefix>📁</template>
                  </a-statistic>
                </a-col>
                <a-col :span="12">
                  <a-statistic title="总项目数" :value="folderStats.totalDescendants">
                    <template #prefix>📊</template>
                  </a-statistic>
                </a-col>
              </a-row>
              <a-descriptions :column="2" size="small" bordered>
                <a-descriptions-item label="书签">
                  {{ folderStats.childBookmarks }} 直接 / {{ folderStats.totalBookmarks }} 总计
                </a-descriptions-item>
                <a-descriptions-item label="文件夹">
                  {{ folderStats.childFolders }} 直接 / {{ folderStats.totalFolders }} 总计
                </a-descriptions-item>
              </a-descriptions>
            </a-space>
          </div>

          <!-- Type -->
          <div class="detail-section">
            <label>类型</label>
            <a-tag :color="selectedNode.url ? 'blue' : 'green'">
              {{ selectedNode.url ? '书签' : '文件夹' }}
            </a-tag>
          </div>

          <!-- Tags -->
          <div class="detail-section">
            <label>标签</label>
            <div v-if="selectedNode.tags.length > 0" class="tags-list">
              <a-tag
                v-for="tag in selectedNode.tags"
                :key="tag"
                color="blue"
              >
                <tags-outlined />
                {{ tag }}
              </a-tag>
            </div>
            <a-empty v-else description="无标签" />
          </div>

          <!-- Dates -->
          <div class="detail-section">
            <label>添加时间</label>
            <div>{{ formatDate(selectedNode.addDate) }}</div>
          </div>

          <div class="detail-section">
            <label>最后修改</label>
            <div>{{ formatDate(selectedNode.lastModified) }}</div>
          </div>

          <!-- Duplicate Status -->
          <div v-if="selectedNode.isDuplicate" class="detail-section">
            <a-alert
              message="检测到重复"
              description="此书签在合并树中存在重复项。"
              type="warning"
              show-icon
            />
          </div>

          <!-- Actions -->
          <div class="detail-actions">
            <a-space direction="vertical" style="width: 100%">
              <a-button 
                type="primary" 
                block 
                :disabled="!isEditModeEnabled"
                @click="handleEdit"
              >
                <template #icon><edit-outlined /></template>
                编辑
              </a-button>
              <a-button v-if="selectedNode.url" block @click="handleOpenUrl">
                <template #icon><link-outlined /></template>
                打开链接
              </a-button>
              <a-button 
                danger 
                block 
                :disabled="!isEditModeEnabled"
                @click="handleDelete"
              >
                <template #icon><delete-outlined /></template>
                删除
              </a-button>
            </a-space>
          </div>
        </div>
      </a-drawer>
    </div>
  </div>
</template>

<style scoped>
.bookmark-tree-canvas {
  width: 100%;
  height: 100%;
  /* min-height: calc(100vh - 165px); */
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  position: relative;
}

.content-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.tree-container {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 155px);
  overflow: hidden;
  position: relative;
  background: #fafafa;
}

/* Context Menu */
.context-menu {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  padding: 4px 0;
  min-width: 150px;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.context-menu-item:hover {
  background: #f3f4f6;
}

.context-menu-item.danger {
  color: #ef4444;
}

.context-menu-item.danger:hover {
  background: #fee2e2;
}

.context-menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.context-menu-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

/* Legend */
.legend {
  position: absolute;
  top: 16px;
  right: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  padding: 12px;
  font-size: 12px;
  max-width: 200px;
  z-index: 10;
}

.legend-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #374151;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid;
  flex-shrink: 0;
}

.legend-tips {
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Detail Panel */
.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-section label {
  font-weight: 600;
  color: #595959;
  font-size: 12px;
  text-transform: uppercase;
}

.detail-section h3 {
  margin: 0;
  font-size: 18px;
  color: #262626;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-actions {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}
</style>
