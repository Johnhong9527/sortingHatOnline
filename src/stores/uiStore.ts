/**
 * UI Store - Manages UI state and user interactions
 * Handles modals, notifications, loading states, and UI preferences
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BookmarkNode, DuplicateGroup, ExportFormat } from '@/utils/wasmBridge'

export type ModalType =
  | 'none'
  | 'duplicateResolution'
  | 'editBookmark'
  | 'addBookmark'
  | 'addFolder'
  | 'tagManagement'
  | 'export'

export interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
  duration?: number
}

export const useUiStore = defineStore('ui', () => {
  // ==================== State ====================

  // Modal state
  const activeModal = ref<ModalType>('none')
  const modalData = ref<any>(null)

  // Sidebar state
  const sidebarCollapsed = ref(false)
  const sidebarWidth = ref(280)

  // File selection for merging
  const selectedFileIds = ref<Set<string>>(new Set())

  // Notifications
  const notifications = ref<NotificationOptions[]>([])

  // Export state
  const exportFormat = ref<ExportFormat>('html')
  const exportPreview = ref<string>('')

  // Edit state
  const editingNode = ref<BookmarkNode | null>(null)

  // Duplicate resolution state
  const resolvingDuplicates = ref<DuplicateGroup[]>([])
  const selectedDuplicateChoices = ref<Map<string, string>>(new Map()) // url -> nodeId to keep

  // View preferences
  const viewMode = ref<'tree' | 'list'>('tree')
  const sortBy = ref<'title' | 'date' | 'type'>('type')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  // Tree visualization state
  const expandedNodes = ref<Set<string>>(new Set())
  const selectedNodeId = ref<string | null>(null)
  const hoveredNodeId = ref<string | null>(null)

  // ==================== Computed ====================

  const hasSelectedFiles = computed(() => selectedFileIds.value.size > 0)

  const canMerge = computed(() => selectedFileIds.value.size >= 2)

  const hasActiveModal = computed(() => activeModal.value !== 'none')

  // Convenience computed properties for modal visibility
  const showDuplicateModal = computed({
    get: () => activeModal.value === 'duplicateResolution',
    set: (value: boolean) => {
      if (value) openModal('duplicateResolution')
      else closeModal()
    }
  })

  const showEditModal = computed({
    get: () => activeModal.value === 'editBookmark' || activeModal.value === 'addBookmark',
    set: (value: boolean) => {
      if (value) openModal('editBookmark')
      else closeModal()
    }
  })

  const showExportModal = computed({
    get: () => activeModal.value === 'export',
    set: (value: boolean) => {
      if (value) openModal('export')
      else closeModal()
    }
  })

  const showTagPanel = computed({
    get: () => activeModal.value === 'tagManagement',
    set: (value: boolean) => {
      if (value) openModal('tagManagement')
      else closeModal()
    }
  })

  // ==================== Actions ====================

  /**
   * Open a modal
   */
  function openModal(type: ModalType, data?: any): void {
    activeModal.value = type
    modalData.value = data
  }

  /**
   * Close active modal
   */
  function closeModal(): void {
    activeModal.value = 'none'
    modalData.value = null
  }

  /**
   * Show notification
   */
  function showNotification(options: NotificationOptions): void {
    const notification = {
      ...options,
      duration: options.duration || 3000,
    }

    notifications.value.push(notification)

    // Auto-remove after duration
    if (notification.duration > 0) {
      setTimeout(() => {
        removeNotification(notification)
      }, notification.duration)
    }
  }

  /**
   * Remove notification
   */
  function removeNotification(notification: NotificationOptions): void {
    const index = notifications.value.indexOf(notification)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  /**
   * Show success notification
   */
  function showSuccess(message: string, description?: string): void {
    showNotification({
      type: 'success',
      message,
      description,
    })
  }

  /**
   * Show error notification
   */
  function showError(message: string, description?: string): void {
    showNotification({
      type: 'error',
      message,
      description,
      duration: 5000,
    })
  }

  /**
   * Show warning notification
   */
  function showWarning(message: string, description?: string): void {
    showNotification({
      type: 'warning',
      message,
      description,
    })
  }

  /**
   * Show info notification
   */
  function showInfo(message: string, description?: string): void {
    showNotification({
      type: 'info',
      message,
      description,
    })
  }

  /**
   * Toggle sidebar
   */
  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  /**
   * Set sidebar width
   */
  function setSidebarWidth(width: number): void {
    sidebarWidth.value = Math.max(200, Math.min(500, width))
  }

  /**
   * Toggle file selection
   */
  function toggleFileSelection(fileId: string): void {
    if (selectedFileIds.value.has(fileId)) {
      selectedFileIds.value.delete(fileId)
    } else {
      selectedFileIds.value.add(fileId)
    }
  }

  /**
   * Select all files
   */
  function selectAllFiles(fileIds: string[]): void {
    selectedFileIds.value = new Set(fileIds)
  }

  /**
   * Clear file selection
   */
  function clearFileSelection(): void {
    selectedFileIds.value.clear()
  }

  /**
   * Set export format
   */
  function setExportFormat(format: ExportFormat): void {
    exportFormat.value = format
  }

  /**
   * Set export preview
   */
  function setExportPreview(preview: string): void {
    exportPreview.value = preview
  }

  /**
   * Open edit bookmark modal
   */
  function openEditBookmark(node: BookmarkNode): void {
    editingNode.value = node
    openModal('editBookmark', node)
  }

  /**
   * Open add bookmark modal
   */
  function openAddBookmark(parentId: string): void {
    openModal('addBookmark', { parentId })
  }

  /**
   * Open add folder modal
   */
  function openAddFolder(parentId: string): void {
    openModal('addFolder', { parentId })
  }

  /**
   * Open duplicate resolution modal
   */
  function openDuplicateResolution(duplicates: DuplicateGroup[]): void {
    resolvingDuplicates.value = duplicates
    selectedDuplicateChoices.value.clear()

    // Pre-select the newest bookmark for each duplicate group
    duplicates.forEach((group) => {
      const newest = group.nodes.reduce((prev, current) =>
        current.addDate > prev.addDate ? current : prev
      )
      selectedDuplicateChoices.value.set(group.url, newest.id)
    })

    openModal('duplicateResolution', duplicates)
  }

  /**
   * Set duplicate choice
   */
  function setDuplicateChoice(url: string, nodeId: string): void {
    selectedDuplicateChoices.value.set(url, nodeId)
  }

  /**
   * Open tag management modal
   */
  function openTagManagement(): void {
    openModal('tagManagement')
  }

  /**
   * Open export modal
   */
  function openExport(): void {
    openModal('export')
  }

  /**
   * Set view mode
   */
  function setViewMode(mode: 'tree' | 'list'): void {
    viewMode.value = mode
  }

  /**
   * Set sort options
   */
  function setSortOptions(by: 'title' | 'date' | 'type', order: 'asc' | 'desc'): void {
    sortBy.value = by
    sortOrder.value = order
  }

  /**
   * Toggle node expansion
   */
  function toggleNodeExpansion(nodeId: string): void {
    if (expandedNodes.value.has(nodeId)) {
      expandedNodes.value.delete(nodeId)
    } else {
      expandedNodes.value.add(nodeId)
    }
  }

  /**
   * Expand node
   */
  function expandNode(nodeId: string): void {
    expandedNodes.value.add(nodeId)
  }

  /**
   * Collapse node
   */
  function collapseNode(nodeId: string): void {
    expandedNodes.value.delete(nodeId)
  }

  /**
   * Expand all nodes
   */
  function expandAll(nodeIds: string[]): void {
    nodeIds.forEach((id) => expandedNodes.value.add(id))
  }

  /**
   * Collapse all nodes
   */
  function collapseAll(): void {
    expandedNodes.value.clear()
  }

  /**
   * Select node
   */
  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
  }

  /**
   * Set hovered node
   */
  function setHoveredNode(nodeId: string | null): void {
    hoveredNodeId.value = nodeId
  }

  /**
   * Reset UI state
   */
  function reset(): void {
    activeModal.value = 'none'
    modalData.value = null
    sidebarCollapsed.value = false
    selectedFileIds.value.clear()
    notifications.value = []
    exportFormat.value = 'html'
    exportPreview.value = ''
    editingNode.value = null
    resolvingDuplicates.value = []
    selectedDuplicateChoices.value.clear()
    viewMode.value = 'tree'
    sortBy.value = 'type'
    sortOrder.value = 'asc'
    expandedNodes.value.clear()
    selectedNodeId.value = null
    hoveredNodeId.value = null
  }

  return {
    // State
    activeModal,
    modalData,
    sidebarCollapsed,
    sidebarWidth,
    selectedFileIds,
    notifications,
    exportFormat,
    exportPreview,
    editingNode,
    resolvingDuplicates,
    selectedDuplicateChoices,
    viewMode,
    sortBy,
    sortOrder,
    expandedNodes,
    selectedNodeId,
    hoveredNodeId,

    // Computed
    hasSelectedFiles,
    canMerge,
    hasActiveModal,
    showDuplicateModal,
    showEditModal,
    showExportModal,
    showTagPanel,

    // Actions
    openModal,
    closeModal,
    showNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    toggleSidebar,
    setSidebarWidth,
    toggleFileSelection,
    selectAllFiles,
    clearFileSelection,
    setExportFormat,
    setExportPreview,
    openEditBookmark,
    openAddBookmark,
    openAddFolder,
    openDuplicateResolution,
    setDuplicateChoice,
    openTagManagement,
    openExport,
    setViewMode,
    setSortOptions,
    toggleNodeExpansion,
    expandNode,
    collapseNode,
    expandAll,
    collapseAll,
    selectNode,
    setHoveredNode,
    reset,
  }
})
