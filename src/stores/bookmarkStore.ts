/**
 * Bookmark Store - Main business logic for bookmark management
 * Handles file operations, merging, searching, editing, and history
 */

import { defineStore } from 'pinia'
import { ref, computed, watch, toRaw } from 'vue'
import { wasmBridge } from '@/utils/wasmBridge'
import type { BookmarkNode, DuplicateGroup, ExportFormat } from '@/utils/wasmBridge'
import {
  getAllTags,
  countBookmarks,
  countFolders,
} from '@/utils/treeUtils'
import { repository } from '@/db/repository'
import type { StoredFile } from '@/db/schema'

interface FileInfo {
  id: string
  name: string
  uploadDate: number
  nodes: BookmarkNode[]
}

interface HistoryState {
  past: BookmarkNode[][]
  future: BookmarkNode[][]
}

export const useBookmarkStore = defineStore('bookmark', () => {
  // ==================== State ====================

  // File management
  const files = ref<Map<string, FileInfo>>(new Map())
  const activeFileId = ref<string | null>(null)

  // Merged tree state
  const mergedNodes = ref<BookmarkNode[]>([])
  const duplicates = ref<DuplicateGroup[]>([])

  // Search state
  const searchQuery = ref<string>('')
  const searchResults = ref<string[]>([])

  // Tag management
  const allTags = ref<Set<string>>(new Set())
  const activeTagFilter = ref<string | null>(null)

  // History for undo/redo
  const history = ref<HistoryState>({
    past: [],
    future: [],
  })

  // Loading states
  const isLoading = ref(false)
  const loadingMessage = ref('')

  // ==================== Computed ====================

  const activeFile = computed(() => {
    if (!activeFileId.value) return null
    const file = files.value.get(activeFileId.value) || null
    console.log('🔍 activeFile computed, nodes count:', file?.nodes.length)
    return file
  })

  const activeTree = computed(() => {
    if (!activeFile.value) return []
    console.log('🌳 activeTree computed, tree length:', activeFile.value.nodes.length)
    return activeFile.value.nodes
  })

  const mergedTree = computed(() => {
    return mergedNodes.value
  })

  const currentTree = computed(() => {
    const tree = mergedTree.value.length > 0 ? mergedTree.value : activeTree.value
    console.log('🎯 currentTree computed, tree length:', tree.length)
    return tree
  })

  const stats = computed(() => {
    const tree = currentTree.value
    return {
      totalFiles: files.value.size,
      totalBookmarks: countBookmarks(tree),
      totalFolders: countFolders(tree),
      totalDuplicates: duplicates.value.length,
      totalTags: allTags.value.size,
    }
  })

  const canUndo = computed(() => history.value.past.length > 0)
  const canRedo = computed(() => history.value.future.length > 0)

  // Current nodes source (merged or active file)
  const currentNodes = computed(() => 
    mergedNodes.value.length > 0 ? mergedNodes.value : activeFile.value?.nodes || []
  )

  // ==================== Watchers ====================

  // Auto-persist merged tree when it changes
  watch(mergedNodes, async () => {
    if (mergedNodes.value.length > 0) {
      await persistMergedTree()
    }
  }, { deep: true })

  // Auto-persist tags when they change
  watch(allTags, async () => {
    await persistTags()
  }, { deep: true })

  // ==================== Actions ====================

  /**
   * Apply node updates and persist changes
   * This eliminates the special case of checking merged vs active file
   */
  async function applyNodeUpdates(updatedNodes: BookmarkNode[]): Promise<void> {
    if (mergedNodes.value.length > 0) {
      mergedNodes.value = updatedNodes
    } else if (activeFile.value && activeFileId.value) {
      const fileInfo = files.value.get(activeFileId.value)
      if (fileInfo) {
        // Update the file info with new nodes
        // Create a new array to ensure Vue reactivity
        const updatedFileInfo = {
          ...fileInfo,
          nodes: [...updatedNodes]  // Create new array reference
        }
        // Create a new Map to trigger Vue reactivity
        const newFiles = new Map(files.value)
        newFiles.set(activeFileId.value, updatedFileInfo)
        files.value = newFiles

        console.log('🔄 Applied node updates, new files Map created')
        console.log('Updated file nodes count:', updatedFileInfo.nodes.length)
      }
      await persistActiveFile()
    }
    updateAllTags()
  }

  /**
   * Initialize Wasm module and load persisted data
   */
  async function initialize() {
    try {
      isLoading.value = true
      loadingMessage.value = 'Initializing bookmark manager...'

      // Initialize Wasm
      await wasmBridge.init()

      // Load persisted data from IndexedDB
      await loadPersistedData()

      console.log('✅ Bookmark store initialized')
    } catch (error) {
      console.error('Failed to initialize bookmark store:', error)
      throw error
    } finally {
      isLoading.value = false
      loadingMessage.value = ''
    }
  }

  /**
   * Load persisted data from IndexedDB
   */
  async function loadPersistedData() {
    try {
      // Load files
      const storedFiles = await repository.files.getAllFiles()
      storedFiles.forEach(file => {
        files.value.set(file.id, {
          id: file.id,
          name: file.name,
          uploadDate: file.uploadDate,
          nodes: file.nodes,
        })
      })

      // Load merged tree
      const storedMergedTree = await repository.mergedTree.getMergedTree()
      if (storedMergedTree) {
        mergedNodes.value = storedMergedTree.nodes
        duplicates.value = storedMergedTree.duplicates
      }

      // Set active file to the most recent one
      if (files.value.size > 0) {
        const sortedFiles = Array.from(files.value.values()).sort(
          (a, b) => b.uploadDate - a.uploadDate
        )
        activeFileId.value = sortedFiles[0].id
      }

      // Update tags
      updateAllTags()

      console.log(`✅ Loaded ${files.value.size} files from IndexedDB`)
    } catch (error) {
      console.error('Failed to load persisted data:', error)
    }
  }

  /**
   * Persist file to IndexedDB
   */
  async function persistFile(fileInfo: FileInfo, rawHtml: string) {
    try {
      const storedFile: StoredFile = {
        id: fileInfo.id,
        name: fileInfo.name,
        uploadDate: fileInfo.uploadDate,
        rawHtml,
        // Use toRaw to convert Vue reactive proxies to plain objects
        nodes: JSON.parse(JSON.stringify(toRaw(fileInfo.nodes))),
      }
      await repository.files.saveFile(storedFile)
    } catch (error) {
      console.error('Failed to persist file:', error)
    }
  }

  /**
   * Persist active file to IndexedDB
   */
  async function persistActiveFile() {
    try {
      if (!activeFile.value) return

      const storedFile = await repository.files.getFile(activeFile.value.id)
      if (storedFile) {
        // Update the stored file with new nodes
        // Use toRaw to convert Vue reactive proxies to plain objects
        storedFile.nodes = JSON.parse(JSON.stringify(toRaw(activeFile.value.nodes)))
        await repository.files.saveFile(storedFile)
        console.log(`✅ Persisted active file ${activeFile.value.id} to IndexedDB`)
      }
    } catch (error) {
      console.error('Failed to persist active file:', error)
    }
  }

  /**
   * Persist merged tree to IndexedDB
   */
  async function persistMergedTree() {
    try {
      if (mergedNodes.value.length > 0) {
        // Use toRaw to convert Vue reactive proxies to plain objects
        const plainNodes = JSON.parse(JSON.stringify(toRaw(mergedNodes.value)))
        const plainDuplicates = JSON.parse(JSON.stringify(toRaw(duplicates.value)))
        await repository.mergedTree.saveMergedTree(plainNodes, plainDuplicates)
      }
    } catch (error) {
      console.error('Failed to persist merged tree:', error)
    }
  }

  /**
   * Persist tags to IndexedDB
   */
  async function persistTags() {
    try {
      const nodes = mergedNodes.value.length > 0 ? mergedNodes.value : activeFile.value?.nodes || []
      const tagCounts = new Map<string, number>()

      nodes.forEach(node => {
        node.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
        })
      })

      await repository.tags.updateTags(tagCounts)
    } catch (error) {
      console.error('Failed to persist tags:', error)
    }
  }

  /**
   * Upload and parse a bookmark file
   */
  async function uploadFile(file: File): Promise<string> {
    try {
      isLoading.value = true
      loadingMessage.value = `Parsing ${file.name}...`

      // Read file content
      const content = await file.text()

      // Parse HTML using Wasm
      const nodes = await wasmBridge.parseHtml(content)

      // Create file info
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const fileInfo: FileInfo = {
        id: fileId,
        name: file.name,
        uploadDate: Date.now(),
        nodes,
      }

      // Store file in memory
      files.value.set(fileId, fileInfo)

      // Persist to IndexedDB
      await persistFile(fileInfo, content)

      // Set as active if it's the first file
      if (files.value.size === 1) {
        activeFileId.value = fileId
      }

      // Update tags
      updateAllTags()
      await persistTags()

      console.log(`✅ Uploaded file: ${file.name} (${nodes.length} nodes)`)
      return fileId
    } catch (error) {
      console.error('Failed to upload file:', error)
      throw error
    } finally {
      isLoading.value = false
      loadingMessage.value = ''
    }
  }

  /**
   * Merge selected files
   */
  async function mergeFiles(fileIds: string[]): Promise<void> {
    try {
      isLoading.value = true
      loadingMessage.value = 'Merging bookmark files...'

      if (fileIds.length < 2) {
        throw new Error('Please select at least 2 files to merge')
      }

      // Get all nodes from selected files
      const allNodes: BookmarkNode[] = []
      for (const fileId of fileIds) {
        const file = files.value.get(fileId)
        if (file) {
          allNodes.push(...file.nodes)
        }
      }

      // For simplicity, we'll merge by combining all nodes
      // In a real implementation, you'd use the merge_trees function iteratively
      mergedNodes.value = allNodes

      // Find duplicates
      await findDuplicatesInMerged()

      // Update tags
      updateAllTags()

      // Persist merged tree
      await persistMergedTree()
      await persistTags()

      console.log(`✅ Merged ${fileIds.length} files (${allNodes.length} total nodes)`)
    } catch (error) {
      console.error('Failed to merge files:', error)
      throw error
    } finally {
      isLoading.value = false
      loadingMessage.value = ''
    }
  }

  /**
   * Find duplicates in merged tree
   */
  async function findDuplicatesInMerged(): Promise<void> {
    try {
      if (mergedNodes.value.length === 0) return

      const dupes = await wasmBridge.findDuplicates(mergedNodes.value)
      duplicates.value = dupes

      console.log(`Found ${dupes.length} duplicate groups`)
    } catch (error) {
      console.error('Failed to find duplicates:', error)
      throw error
    }
  }

  /**
   * Resolve a duplicate by keeping one node
   */
  async function resolveDuplicate(duplicateGroup: DuplicateGroup, keepNodeId: string): Promise<void> {
    try {
      pushToHistory()

      // Remove all nodes in the group except the one to keep
      const nodesToRemove = duplicateGroup.nodes
        .filter((node) => node.id !== keepNodeId)
        .map((node) => node.id)

      // Batch delete all nodes
      let updated = currentNodes.value
      for (const nodeId of nodesToRemove) {
        updated = await wasmBridge.deleteNode(updated, nodeId)
      }

      await applyNodeUpdates(updated)

      // Update duplicates list
      await findDuplicatesInMerged()

      console.log(`✅ Resolved duplicate for ${duplicateGroup.url}`)
    } catch (error) {
      console.error('Failed to resolve duplicate:', error)
      throw error
    }
  }

  /**
   * Search bookmarks
   */
  async function search(query: string): Promise<void> {
    try {
      searchQuery.value = query

      if (!query.trim()) {
        searchResults.value = []
        return
      }

      const nodes = mergedNodes.value.length > 0 ? mergedNodes.value : activeFile.value?.nodes || []

      if (nodes.length === 0) {
        searchResults.value = []
        return
      }

      const results = await wasmBridge.searchNodes(nodes, query)
      searchResults.value = results

      console.log(`🔍 Search "${query}" found ${results.length} results`)
    } catch (error) {
      console.error('Failed to search:', error)
      throw error
    }
  }

  /**
   * Clear search
   */
  function clearSearch(): void {
    searchQuery.value = ''
    searchResults.value = []
  }

  /**
   * Filter by tag
   */
  function filterByTag(tag: string | null): void {
    activeTagFilter.value = tag
    if (tag) {
      search(`tag:${tag}`)
    } else {
      clearSearch()
    }
  }

  /**
   * Update a bookmark
   */
  async function updateBookmark(nodeId: string, updates: Partial<BookmarkNode>): Promise<void> {
    try {
      pushToHistory()

      const updated = await wasmBridge.updateNode(currentNodes.value, nodeId, updates)
      await applyNodeUpdates(updated)

      console.log(`✅ Updated bookmark ${nodeId}`)
    } catch (error) {
      console.error('Failed to update bookmark:', error)
      throw error
    }
  }

  /**
   * Delete a bookmark
   */
  async function deleteBookmark(nodeId: string): Promise<void> {
    try {
      pushToHistory()

      const updated = await wasmBridge.deleteNode(currentNodes.value, nodeId)
      await applyNodeUpdates(updated)

      console.log(`✅ Deleted bookmark ${nodeId}`)
    } catch (error) {
      console.error('Failed to delete bookmark:', error)
      throw error
    }
  }

  /**
   * Add a new bookmark
   */
  async function addBookmark(parentId: string, bookmark: Omit<BookmarkNode, 'id'>): Promise<void> {
    try {
      pushToHistory()

      // Rust WASM expects a complete BookmarkNode with id field (it will be overwritten)
      // So we add a temporary id here
      const bookmarkWithId: BookmarkNode = {
        ...bookmark,
        id: '' // Temporary id, will be overwritten by Rust
      }

      const updated = await wasmBridge.addNode(currentNodes.value, parentId, bookmarkWithId)
      await applyNodeUpdates(updated)

      console.log(`✅ Added new bookmark`)
    } catch (error) {
      console.error('Failed to add bookmark:', error)
      throw error
    }
  }

  /**
   * Add a folder
   */
  async function addFolder(parentId: string, name: string): Promise<void> {
    const folder: Omit<BookmarkNode, 'id'> = {
      title: name,
      url: null,
      addDate: Date.now(),
      lastModified: Date.now(),
      tags: [],
      isDuplicate: false,
      children: [],
    }

    await addBookmark(parentId, folder)
  }

  /**
   * Move a node to a new parent
   */
  async function moveNode(nodeId: string, newParentId: string): Promise<void> {
    try {
      pushToHistory()

      const updated = await wasmBridge.moveNode(currentNodes.value, nodeId, newParentId)
      await applyNodeUpdates(updated)

      console.log(`✅ Moved node ${nodeId} to ${newParentId}`)
    } catch (error) {
      console.error('Failed to move node:', error)
      throw error
    }
  }

  /**
   * Move a node to a specific position relative to a sibling
   */
  async function moveNodeRelative(nodeId: string, siblingId: string, position: 'before' | 'after'): Promise<void> {
    try {
      pushToHistory()

      const updated = await wasmBridge.moveNodeRelative(currentNodes.value, nodeId, siblingId, position)
      await applyNodeUpdates(updated)

      console.log(`✅ Moved node ${nodeId} ${position} ${siblingId}`)
    } catch (error) {
      console.error('Failed to move node relative:', error)
      throw error
    }
  }

  /**
   * Add a tag to a bookmark
   */
  async function addTag(nodeId: string, tag: string): Promise<void> {
    try {
      const updated = await wasmBridge.addTag(currentNodes.value, nodeId, tag)
      await applyNodeUpdates(updated)

      console.log(`✅ Added tag "${tag}" to ${nodeId}`)
    } catch (error) {
      console.error('Failed to add tag:', error)
      throw error
    }
  }

  /**
   * Remove a tag from a bookmark
   */
  async function removeTag(nodeId: string, tag: string): Promise<void> {
    try {
      const updated = await wasmBridge.removeTag(currentNodes.value, nodeId, tag)
      await applyNodeUpdates(updated)

      console.log(`✅ Removed tag "${tag}" from ${nodeId}`)
    } catch (error) {
      console.error('Failed to remove tag:', error)
      throw error
    }
  }

  /**
   * Rename a tag across all bookmarks
   */
  async function renameTag(oldTag: string, newTag: string): Promise<void> {
    try {
      pushToHistory()

      const nodes = currentNodes.value
      const updated = nodes.map(node => {
        if (node.tags.includes(oldTag)) {
          return {
            ...node,
            tags: node.tags.map(t => t === oldTag ? newTag : t)
          }
        }
        return node
      })

      const affectedCount = nodes.filter(node => node.tags.includes(oldTag)).length
      await applyNodeUpdates(updated)

      console.log(`✅ Renamed tag "${oldTag}" to "${newTag}" (${affectedCount} bookmarks)`)
    } catch (error) {
      console.error('Failed to rename tag:', error)
      throw error
    }
  }

  /**
   * Delete a tag from all bookmarks
   */
  async function deleteTag(tag: string): Promise<void> {
    try {
      pushToHistory()

      const nodes = currentNodes.value
      const updated = nodes.map(node => {
        if (node.tags.includes(tag)) {
          return {
            ...node,
            tags: node.tags.filter(t => t !== tag)
          }
        }
        return node
      })

      const affectedCount = nodes.filter(node => node.tags.includes(tag)).length
      await applyNodeUpdates(updated)

      console.log(`✅ Deleted tag "${tag}" from ${affectedCount} bookmarks`)
    } catch (error) {
      console.error('Failed to delete tag:', error)
      throw error
    }
  }

  /**
   * Export bookmarks to specified format
   */
  async function exportBookmarks(format: ExportFormat): Promise<string> {
    try {
      isLoading.value = true
      loadingMessage.value = `Exporting to ${format.toUpperCase()}...`

      const nodes = mergedNodes.value.length > 0 ? mergedNodes.value : activeFile.value?.nodes || []

      if (nodes.length === 0) {
        throw new Error('No bookmarks to export')
      }

      const result = await wasmBridge.export(nodes, format)

      console.log(`✅ Exported ${nodes.length} bookmarks to ${format}`)
      return result
    } catch (error) {
      console.error('Failed to export:', error)
      throw error
    } finally {
      isLoading.value = false
      loadingMessage.value = ''
    }
  }

  /**
   * Download exported bookmarks as file
   */
  async function downloadExport(format: ExportFormat, filename?: string): Promise<void> {
    try {
      const content = await exportBookmarks(format)

      // Create blob and download
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `bookmarks_${Date.now()}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log(`✅ Downloaded ${filename || 'bookmarks'}.${format}`)
    } catch (error) {
      console.error('Failed to download export:', error)
      throw error
    }
  }

  /**
   * Push current state to history for undo
   */
  function pushToHistory(): void {
    const nodes = mergedNodes.value.length > 0 ? mergedNodes.value : activeFile.value?.nodes || []

    if (nodes.length === 0) return

    // Clone current state
    const snapshot = JSON.parse(JSON.stringify(nodes))

    // Add to past
    history.value.past.push(snapshot)

    // Clear future (new action invalidates redo)
    history.value.future = []

    // Limit history to 50 items
    if (history.value.past.length > 50) {
      history.value.past.shift()
    }
  }

  /**
   * Undo last action
   */
  async function undo(): Promise<void> {
    if (!canUndo.value) return

    const nodes = currentNodes.value

    // Save current state to future
    history.value.future.push(JSON.parse(JSON.stringify(nodes)))

    // Restore previous state
    const previousState = history.value.past.pop()!

    await applyNodeUpdates(previousState)

    console.log('↶ Undo')
  }

  /**
   * Redo last undone action
   */
  async function redo(): Promise<void> {
    if (!canRedo.value) return

    const nodes = currentNodes.value

    // Save current state to past
    history.value.past.push(JSON.parse(JSON.stringify(nodes)))

    // Restore next state
    const nextState = history.value.future.pop()!

    await applyNodeUpdates(nextState)

    console.log('↷ Redo')
  }

  /**
   * Update all tags from current tree
   */
  function updateAllTags(): void {
    const tree = currentTree.value
    allTags.value = getAllTags(tree)
  }

  /**
   * Delete a file
   */
  async function deleteFile(fileId: string): Promise<void> {
    files.value.delete(fileId)

    // Delete from IndexedDB
    await repository.files.deleteFile(fileId)

    if (activeFileId.value === fileId) {
      activeFileId.value = files.value.size > 0 ? Array.from(files.value.keys())[0] : null
    }

    updateAllTags()
    await persistTags()
    console.log(`✅ Deleted file ${fileId}`)
  }

  /**
   * Clear merged tree
   */
  async function clearMerged(): Promise<void> {
    mergedNodes.value = []
    duplicates.value = []

    // Clear from IndexedDB
    await repository.mergedTree.clearMergedTree()

    updateAllTags()
    console.log('✅ Cleared merged tree')
  }

  /**
   * Reset store
   */
  function reset(): void {
    files.value.clear()
    activeFileId.value = null
    mergedNodes.value = []
    duplicates.value = []
    searchQuery.value = ''
    searchResults.value = []
    allTags.value.clear()
    activeTagFilter.value = null
    history.value = { past: [], future: [] }
    console.log('✅ Reset bookmark store')
  }

  return {
    // State
    files,
    activeFileId,
    mergedNodes,
    duplicates,
    searchQuery,
    searchResults,
    allTags,
    activeTagFilter,
    history,
    isLoading,
    loadingMessage,

    // Computed
    activeFile,
    activeTree,
    mergedTree,
    currentTree,
    currentNodes,
    stats,
    canUndo,
    canRedo,

    // Actions
    initialize,
    uploadFile,
    mergeFiles,
    findDuplicatesInMerged,
    resolveDuplicate,
    search,
    clearSearch,
    filterByTag,
    updateBookmark,
    deleteBookmark,
    addBookmark,
    addFolder,
    moveNode,
    moveNodeRelative,
    addTag,
    removeTag,
    renameTag,
    deleteTag,
    exportBookmarks,
    downloadExport,
    undo,
    redo,
    deleteFile,
    clearMerged,
    reset,
  }
})
