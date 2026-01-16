/**
 * Tree utility functions for bookmark manipulation
 * Handles conversion between flat and nested structures
 */

import type { BookmarkNode } from './wasmBridge'

/**
 * Convert flat array of nodes to nested tree structure
 * @param nodes - Flat array of bookmark nodes
 * @returns Nested tree structure with children
 */
export function flatToTree(nodes: BookmarkNode[]): BookmarkNode[] {
  if (!nodes || nodes.length === 0) {
    return []
  }

  // Create a map for quick lookup
  const nodeMap = new Map<string, BookmarkNode>()
  const rootNodes: BookmarkNode[] = []

  // First pass: create map and initialize children arrays
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] })
  })

  // Second pass: build tree structure
  nodes.forEach((node) => {
    const treeNode = nodeMap.get(node.id)!

    if (node.parentId === null || node.parentId === undefined) {
      // Root node
      rootNodes.push(treeNode)
    } else {
      // Child node - add to parent's children
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(treeNode)
      } else {
        // Parent not found, treat as root
        rootNodes.push(treeNode)
      }
    }
  })

  return rootNodes
}

/**
 * Convert nested tree structure to flat array
 * @param tree - Nested tree structure
 * @returns Flat array of bookmark nodes
 */
export function treeToFlat(tree: BookmarkNode[]): BookmarkNode[] {
  const flat: BookmarkNode[] = []

  function traverse(nodes: BookmarkNode[]) {
    nodes.forEach((node) => {
      // Create a copy without children for the flat structure
      const { children, ...flatNode } = node
      flat.push(flatNode as BookmarkNode)

      // Recursively traverse children
      if (children && children.length > 0) {
        traverse(children)
      }
    })
  }

  traverse(tree)
  return flat
}

/**
 * Find a node by ID in the tree
 * @param tree - Tree structure to search
 * @param nodeId - ID of the node to find
 * @returns Found node or null
 */
export function findNodeById(
  tree: BookmarkNode[],
  nodeId: string
): BookmarkNode | null {
  for (const node of tree) {
    if (node.id === nodeId) {
      return node
    }

    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, nodeId)
      if (found) {
        return found
      }
    }
  }

  return null
}

/**
 * Get the path (breadcrumb) to a node
 * @param tree - Tree structure
 * @param nodeId - ID of the target node
 * @returns Array of node IDs from root to target, or empty array if not found
 */
export function findNodePath(tree: BookmarkNode[], nodeId: string): string[] {
  function search(nodes: BookmarkNode[], path: string[]): string[] | null {
    for (const node of nodes) {
      const currentPath = [...path, node.id]

      if (node.id === nodeId) {
        return currentPath
      }

      if (node.children && node.children.length > 0) {
        const found = search(node.children, currentPath)
        if (found) {
          return found
        }
      }
    }

    return null
  }

  return search(tree, []) || []
}

/**
 * Get the full path string (folder names) to a node
 * @param tree - Tree structure
 * @param nodeId - ID of the target node
 * @returns Path string like "Folder1/Folder2/Bookmark"
 */
export function getNodePathString(tree: BookmarkNode[], nodeId: string): string {
  const path = findNodePath(tree, nodeId)
  const pathNodes = path.map((id) => findNodeById(tree, id)).filter(Boolean)
  return pathNodes.map((node) => node!.title).join(' / ')
}

/**
 * Count total nodes in tree
 * @param tree - Tree structure
 * @returns Total number of nodes
 */
export function countNodes(tree: BookmarkNode[]): number {
  let count = 0

  function traverse(nodes: BookmarkNode[]) {
    nodes.forEach((node) => {
      count++
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    })
  }

  traverse(tree)
  return count
}

/**
 * Count bookmarks (non-folder nodes) in tree
 * @param tree - Tree structure
 * @returns Number of bookmarks
 */
export function countBookmarks(tree: BookmarkNode[]): number {
  let count = 0

  function traverse(nodes: BookmarkNode[]) {
    nodes.forEach((node) => {
      if (node.url !== null && node.url !== undefined) {
        count++
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    })
  }

  traverse(tree)
  return count
}

/**
 * Count folders in tree
 * @param tree - Tree structure
 * @returns Number of folders
 */
export function countFolders(tree: BookmarkNode[]): number {
  let count = 0

  function traverse(nodes: BookmarkNode[]) {
    nodes.forEach((node) => {
      if (node.url === null || node.url === undefined) {
        count++
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    })
  }

  traverse(tree)
  return count
}

/**
 * Get all unique tags from tree
 * @param tree - Tree structure
 * @returns Set of unique tags
 */
export function getAllTags(tree: BookmarkNode[]): Set<string> {
  const tags = new Set<string>()

  function traverse(nodes: BookmarkNode[]) {
    nodes.forEach((node) => {
      if (node.tags && node.tags.length > 0) {
        node.tags.forEach((tag) => tags.add(tag))
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    })
  }

  traverse(tree)
  return tags
}

/**
 * Filter tree by search results (node IDs)
 * @param tree - Tree structure
 * @param matchingIds - Set of matching node IDs
 * @returns Filtered tree containing only matching nodes and their ancestors
 */
export function filterTreeByIds(
  tree: BookmarkNode[],
  matchingIds: Set<string>
): BookmarkNode[] {
  function filter(nodes: BookmarkNode[]): BookmarkNode[] {
    const filtered: BookmarkNode[] = []

    nodes.forEach((node) => {
      const isMatch = matchingIds.has(node.id)
      let filteredChildren: BookmarkNode[] = []

      if (node.children && node.children.length > 0) {
        filteredChildren = filter(node.children)
      }

      // Include node if it matches or has matching descendants
      if (isMatch || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
        })
      }
    })

    return filtered
  }

  return filter(tree)
}

/**
 * Sort tree nodes
 * @param tree - Tree structure
 * @param sortBy - Sort criteria ('title', 'date', 'type')
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted tree
 */
export function sortTree(
  tree: BookmarkNode[],
  sortBy: 'title' | 'date' | 'type' = 'title',
  order: 'asc' | 'desc' = 'asc'
): BookmarkNode[] {
  function sort(nodes: BookmarkNode[]): BookmarkNode[] {
    const sorted = [...nodes].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'date':
          comparison = a.addDate - b.addDate
          break
        case 'type':
          // Folders first, then bookmarks
          const aIsFolder = a.url === null || a.url === undefined
          const bIsFolder = b.url === null || b.url === undefined
          if (aIsFolder && !bIsFolder) return -1
          if (!aIsFolder && bIsFolder) return 1
          comparison = a.title.localeCompare(b.title)
          break
      }

      return order === 'asc' ? comparison : -comparison
    })

    // Recursively sort children
    return sorted.map((node) => ({
      ...node,
      children: node.children ? sort(node.children) : [],
    }))
  }

  return sort(tree)
}

/**
 * Move a node to a new parent
 * @param nodes - Flat array of nodes
 * @param nodeId - ID of node to move
 * @param newParentId - ID of new parent (null for root)
 * @returns Updated flat array
 */
export function moveNode(
  nodes: BookmarkNode[],
  nodeId: string,
  newParentId: string | null
): BookmarkNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, parentId: newParentId }
    }
    return node
  })
}

/**
 * Check if a node is a folder
 * @param node - Bookmark node
 * @returns True if node is a folder
 */
export function isFolder(node: BookmarkNode): boolean {
  return node.url === null || node.url === undefined
}

/**
 * Get all descendants of a node
 * @param tree - Tree structure
 * @param nodeId - ID of the node
 * @returns Array of all descendant nodes
 */
export function getDescendants(tree: BookmarkNode[], nodeId: string): BookmarkNode[] {
  const node = findNodeById(tree, nodeId)
  if (!node || !node.children) {
    return []
  }

  const descendants: BookmarkNode[] = []

  function traverse(nodes: BookmarkNode[]) {
    nodes.forEach((n) => {
      descendants.push(n)
      if (n.children && n.children.length > 0) {
        traverse(n.children)
      }
    })
  }

  traverse(node.children)
  return descendants
}

/**
 * Clone a tree (deep copy)
 * @param tree - Tree structure
 * @returns Deep copy of the tree
 */
export function cloneTree(tree: BookmarkNode[]): BookmarkNode[] {
  return JSON.parse(JSON.stringify(tree))
}
