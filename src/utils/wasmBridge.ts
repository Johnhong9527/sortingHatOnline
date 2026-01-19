/**
 * TypeScript bridge to Rust WebAssembly module
 * Provides typed interfaces to all bookmark management functions
 */

import init, {
  parse_html,
  find_duplicates,
  merge_trees,
  search_nodes,
  serialize_to_html,
  serialize_to_json,
  serialize_to_csv,
  serialize_to_markdown,
  update_node,
  delete_node,
  add_node,
  add_tag,
  remove_tag,
  move_node,
  move_node_relative,
} from '../../public/wasm/bookmark_wasm.js'

/**
 * BookmarkNode interface matching Rust struct
 */
export interface BookmarkNode {
  id: string
  title: string
  url: string | null
  addDate: number
  lastModified: number
  icon?: string
  tags: string[]
  isDuplicate: boolean
  children: BookmarkNode[]
  parentId?: string  // 父节点ID,用于树形结构导航
}

/**
 * Duplicate group interface
 */
export interface DuplicateGroup {
  url: string
  nodes: BookmarkNode[]
}

/**
 * Export format types
 */
export type ExportFormat = 'html' | 'json' | 'csv' | 'markdown'

/**
 * Wasm Bridge class - singleton for managing Wasm module
 */
export class WasmBridge {
  private static instance: WasmBridge | null = null
  private initialized = false

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): WasmBridge {
    if (!WasmBridge.instance) {
      WasmBridge.instance = new WasmBridge()
    }
    return WasmBridge.instance
  }

  /**
   * Initialize the Wasm module
   * Must be called before using any other methods
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      await init()
      this.initialized = true
      console.log('✅ Wasm module initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Wasm module:', error)
      throw new Error('Failed to initialize Wasm module')
    }
  }

  /**
   * Ensure Wasm is initialized before calling functions
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Wasm module not initialized. Call init() first.')
    }
  }

  /**
   * Parse HTML bookmark file
   * @param html - HTML string in Netscape bookmark format
   * @returns Array of bookmark nodes
   */
  async parseHtml(html: string): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = parse_html(html)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error parsing HTML:', error)
      throw new Error(`Failed to parse HTML: ${error}`)
    }
  }

  /**
   * Find duplicate bookmarks by URL
   * @param nodes - Array of bookmark nodes
   * @returns Array of duplicate groups
   */
  async findDuplicates(nodes: BookmarkNode[]): Promise<DuplicateGroup[]> {
    this.ensureInitialized()

    try {
      const result = find_duplicates(nodes)
      return result as DuplicateGroup[]
    } catch (error) {
      console.error('Error finding duplicates:', error)
      throw new Error(`Failed to find duplicates: ${error}`)
    }
  }

  /**
   * Merge two bookmark trees
   * @param base - Base bookmark tree
   * @param target - Target bookmark tree to merge
   * @returns Merged bookmark tree with duplicates marked
   */
  async mergeTrees(
    base: BookmarkNode[],
    target: BookmarkNode[]
  ): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = merge_trees(base, target)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error merging trees:', error)
      throw new Error(`Failed to merge trees: ${error}`)
    }
  }

  /**
   * Search bookmarks by query
   * Supports general search and tag-specific search (e.g., "tag:work")
   * @param nodes - Array of bookmark nodes
   * @param query - Search query string
   * @returns Array of matching node IDs
   */
  async searchNodes(nodes: BookmarkNode[], query: string): Promise<string[]> {
    this.ensureInitialized()

    try {
      const result = search_nodes(nodes, query)
      return result as string[]
    } catch (error) {
      console.error('Error searching nodes:', error)
      throw new Error(`Failed to search nodes: ${error}`)
    }
  }

  /**
   * Export bookmarks to specified format
   * @param nodes - Array of bookmark nodes
   * @param format - Export format (html, json, csv, markdown)
   * @returns Serialized string in the specified format
   */
  async export(nodes: BookmarkNode[], format: ExportFormat): Promise<string> {
    this.ensureInitialized()

    try {
      switch (format) {
        case 'html':
          return serialize_to_html(nodes)
        case 'json':
          return serialize_to_json(nodes)
        case 'csv':
          return serialize_to_csv(nodes)
        case 'markdown':
          return serialize_to_markdown(nodes)
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error)
      throw new Error(`Failed to export to ${format}: ${error}`)
    }
  }

  /**
   * Update a bookmark node
   * @param nodes - Array of bookmark nodes
   * @param nodeId - ID of the node to update
   * @param updates - Partial updates to apply
   * @returns Updated array of bookmark nodes
   */
  async updateNode(
    nodes: BookmarkNode[],
    nodeId: string,
    updates: Partial<BookmarkNode>
  ): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = update_node(nodes, nodeId, updates)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error updating node:', error)
      throw new Error(`Failed to update node: ${error}`)
    }
  }

  /**
   * Delete a bookmark node (and its children)
   * @param nodes - Array of bookmark nodes
   * @param nodeId - ID of the node to delete
   * @returns Updated array of bookmark nodes
   */
  async deleteNode(nodes: BookmarkNode[], nodeId: string): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = delete_node(nodes, nodeId)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error deleting node:', error)
      throw new Error(`Failed to delete node: ${error}`)
    }
  }

  /**
   * Add a new bookmark node
   * @param nodes - Array of bookmark nodes
   * @param parentId - ID of the parent node
   * @param node - New node to add (without ID)
   * @returns Updated array of bookmark nodes
   */
  async addNode(
    nodes: BookmarkNode[],
    parentId: string,
    node: Omit<BookmarkNode, 'id'>
  ): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = add_node(nodes, parentId, node)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error adding node:', error)
      throw new Error(`Failed to add node: ${error}`)
    }
  }

  /**
   * Add a tag to a bookmark node
   * @param nodes - Array of bookmark nodes
   * @param nodeId - ID of the node
   * @param tag - Tag to add
   * @returns Updated array of bookmark nodes
   */
  async addTag(
    nodes: BookmarkNode[],
    nodeId: string,
    tag: string
  ): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = add_tag(nodes, nodeId, tag)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error adding tag:', error)
      throw new Error(`Failed to add tag: ${error}`)
    }
  }

  /**
   * Remove a tag from a bookmark node
   * @param nodes - Array of bookmark nodes
   * @param nodeId - ID of the node
   * @param tag - Tag to remove
   * @returns Updated array of bookmark nodes
   */
  async removeTag(
    nodes: BookmarkNode[],
    nodeId: string,
    tag: string
  ): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = remove_tag(nodes, nodeId, tag)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error removing tag:', error)
      throw new Error(`Failed to remove tag: ${error}`)
    }
  }

  /**
   * Move a bookmark node to a new parent
   * @param nodes - Array of bookmark nodes
   * @param nodeId - ID of the node to move
   * @param newParentId - ID of the new parent node (use "root" for root level)
   * @returns Updated array of bookmark nodes
   */
  async moveNode(
    nodes: BookmarkNode[],
    nodeId: string,
    newParentId: string
  ): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = move_node(nodes, nodeId, newParentId)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error moving node:', error)
      throw new Error(`Failed to move node: ${error}`)
    }
  }

  /**
   * Move a bookmark node to a specific position relative to a sibling
   * @param nodes - Array of bookmark nodes
   * @param nodeId - ID of the node to move
   * @param siblingId - ID of the sibling node to position relative to
   * @param position - Position relative to sibling ("before" or "after")
   * @returns Updated array of bookmark nodes
   */
  async moveNodeRelative(
    nodes: BookmarkNode[],
    nodeId: string,
    siblingId: string,
    position: 'before' | 'after'
  ): Promise<BookmarkNode[]> {
    this.ensureInitialized()

    try {
      const result = move_node_relative(nodes, nodeId, siblingId, position)
      return result as BookmarkNode[]
    } catch (error) {
      console.error('Error moving node relative:', error)
      throw new Error(`Failed to move node relative: ${error}`)
    }
  }
}

/**
 * Export singleton instance
 */
export const wasmBridge = WasmBridge.getInstance()
