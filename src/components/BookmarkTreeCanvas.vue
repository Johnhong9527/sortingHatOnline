<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import { useCanvasTree } from '@/composables/useCanvasTree'
import type { BookmarkNode } from '@/utils/wasmBridge'
import { EditOutlined, DeleteOutlined, LinkOutlined, TagsOutlined, FolderOutlined } from '@ant-design/icons-vue'
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
const handleNodeClick = (node: BookmarkNode, event: MouseEvent) => {
  // If folder, toggle expansion
  if (!node.url) {
    uiStore.toggleNodeExpansion(node.id)
  } else {
    // If bookmark, show details
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
const handleContextMenuAction = (action: 'edit' | 'delete' | 'rename') => {
  const node = contextMenu.value.node
  if (!node) return

  closeContextMenu()

  switch (action) {
    case 'edit':
      uiStore.openEditBookmark(node)
      break
    case 'delete':
      Modal.confirm({
        title: 'Delete Node',
        content: `Are you sure you want to delete "${node.title}"?`,
        okText: 'Delete',
        okType: 'danger',
        onOk: async () => {
          try {
            await bookmarkStore.deleteBookmark(node.id)
            message.success('Node deleted successfully')
          } catch (error) {
            message.error(`Failed to delete: ${error}`)
          }
        }
      })
      break
    case 'rename':
      uiStore.openEditBookmark(node)
      break
  }
}

// Handle node move
const handleNodeMove = async (nodeId: string, targetId: string) => {
  try {
    await bookmarkStore.moveNode(nodeId, targetId)
    message.success('Node moved successfully')
  } catch (error) {
    message.error(`Failed to move node: ${error}`)
    throw error
  }
}

// Initialize Canvas tree
useCanvasTree(
  containerRef,
  treeData,
  expandedNodes,
  searchResults,
  handleNodeClick,
  handleNodeRightClick,
  handleNodeMove
)

// Handle edit
const handleEdit = () => {
  if (selectedNode.value) {
    uiStore.editingNode = selectedNode.value
    uiStore.showEditModal = true
  }
}

// Handle delete
const handleDelete = () => {
  if (!selectedNode.value) return

  Modal.confirm({
    title: 'Delete Node',
    content: `Are you sure you want to delete "${selectedNode.value.title}"?`,
    okText: 'Delete',
    okType: 'danger',
    onOk: async () => {
      try {
        await bookmarkStore.deleteBookmark(selectedNode.value!.id)
        message.success('Node deleted successfully')
        showDetailPanel.value = false
        selectedNode.value = null
      } catch (error) {
        message.error(`Failed to delete: ${error}`)
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
        description="No bookmarks to display. Upload a file to get started."
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
        <div class="context-menu-item" @click="handleContextMenuAction('edit')">
          <edit-outlined /> Edit
        </div>
        <div class="context-menu-item" @click="handleContextMenuAction('rename')">
          <edit-outlined /> Rename
        </div>
        <div class="context-menu-item danger" @click="handleContextMenuAction('delete')">
          <delete-outlined /> Delete
        </div>
      </div>

      <!-- Legend -->
      <div v-if="treeData.length > 0" class="legend">
        <div class="legend-title">Legend</div>
        <div class="legend-items">
          <div class="legend-item">
            <div class="legend-circle" style="background: #86efac; border-color: #22c55e;"></div>
            <span>Folder</span>
          </div>
          <div class="legend-item">
            <div class="legend-circle" style="background: #e0e7ff; border-color: #6366f1;"></div>
            <span>Bookmark</span>
          </div>
          <div class="legend-item">
            <div class="legend-circle" style="background: #bfdbfe; border-color: #3b82f6;"></div>
            <span>Tagged</span>
          </div>
          <div class="legend-item">
            <div class="legend-circle" style="background: #fef3c7; border-color: #f59e0b;"></div>
            <span>Duplicate</span>
          </div>
          <div class="legend-item">
            <div class="legend-circle" style="background: #fef08a; border-color: #eab308; border-width: 3px;"></div>
            <span>Search Result</span>
          </div>
        </div>
        <div class="legend-tips">
          <div>Click folder to expand/collapse</div>
          <div>Click bookmark to view details</div>
          <div>Right-click for menu</div>
          <div>Drag to move nodes</div>
          <div>Hold Space + Drag to pan</div>
          <div>Scroll to zoom</div>
        </div>
      </div>

      <!-- Detail Panel -->
      <a-drawer
        v-model:open="showDetailPanel"
        title="Node Details"
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
            <label>Folder Contents</label>
            <a-space direction="vertical" style="width: 100%">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-statistic title="Direct Children" :value="folderStats.directChildren">
                    <template #prefix>📁</template>
                  </a-statistic>
                </a-col>
                <a-col :span="12">
                  <a-statistic title="Total Items" :value="folderStats.totalDescendants">
                    <template #prefix>📊</template>
                  </a-statistic>
                </a-col>
              </a-row>
              <a-descriptions :column="2" size="small" bordered>
                <a-descriptions-item label="Bookmarks">
                  {{ folderStats.childBookmarks }} direct / {{ folderStats.totalBookmarks }} total
                </a-descriptions-item>
                <a-descriptions-item label="Folders">
                  {{ folderStats.childFolders }} direct / {{ folderStats.totalFolders }} total
                </a-descriptions-item>
              </a-descriptions>
            </a-space>
          </div>

          <!-- Type -->
          <div class="detail-section">
            <label>Type</label>
            <a-tag :color="selectedNode.url ? 'blue' : 'green'">
              {{ selectedNode.url ? 'Bookmark' : 'Folder' }}
            </a-tag>
          </div>

          <!-- Tags -->
          <div class="detail-section">
            <label>Tags</label>
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
            <a-empty v-else description="No tags" />
          </div>

          <!-- Dates -->
          <div class="detail-section">
            <label>Added</label>
            <div>{{ formatDate(selectedNode.addDate) }}</div>
          </div>

          <div class="detail-section">
            <label>Last Modified</label>
            <div>{{ formatDate(selectedNode.lastModified) }}</div>
          </div>

          <!-- Duplicate Status -->
          <div v-if="selectedNode.isDuplicate" class="detail-section">
            <a-alert
              message="Duplicate Detected"
              description="This bookmark has duplicates in the merged tree."
              type="warning"
              show-icon
            />
          </div>

          <!-- Actions -->
          <div class="detail-actions">
            <a-space direction="vertical" style="width: 100%">
              <a-button type="primary" block @click="handleEdit">
                <template #icon><edit-outlined /></template>
                Edit
              </a-button>
              <a-button v-if="selectedNode.url" block @click="handleOpenUrl">
                <template #icon><link-outlined /></template>
                Open URL
              </a-button>
              <a-button danger block @click="handleDelete">
                <template #icon><delete-outlined /></template>
                Delete
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
