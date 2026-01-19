<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as d3 from 'd3'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import type { BookmarkNode } from '@/utils/wasmBridge'
import { message, Modal } from 'ant-design-vue'

// Stores
const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)

// D3 selections and state
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
let g: d3.Selection<SVGGElement, unknown, null, undefined>
let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
let treeLayout: d3.TreeLayout<BookmarkNode>

// Drag state
let draggedNode: d3.HierarchyPointNode<BookmarkNode> | null = null
let dropTarget: d3.HierarchyPointNode<BookmarkNode> | null = null
let ghostNode: d3.Selection<SVGGElement, unknown, null, undefined> | null = null

// Context menu state
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null as BookmarkNode | null
})

// Computed
const currentTree = computed(() => bookmarkStore.currentTree)
const searchQuery = computed(() => bookmarkStore.searchQuery)
const searchResults = computed(() => new Set(bookmarkStore.searchResults))
const expandedNodes = computed(() => uiStore.expandedNodes)

// Check if tree is large (>2000 nodes)
const isLargeTree = computed(() => {
  const countNodes = (nodes: BookmarkNode[]): number => {
    let count = nodes.length
    nodes.forEach(node => {
      if (node.children) count += countNodes(node.children)
    })
    return count
  }
  return countNodes(currentTree.value) > 2000
})

/**
 * Initialize D3 visualization
 */
function initD3() {
  if (!containerRef.value || !svgRef.value) return

  const container = containerRef.value
  const width = container.clientWidth
  const height = container.clientHeight

  // Create SVG
  svg = d3.select(svgRef.value)
    .attr('width', width)
    .attr('height', height)

  // Clear existing content
  svg.selectAll('*').remove()

  // Create zoom group
  g = svg.append('g')
    .attr('class', 'zoom-group')

  // Create groups for links and nodes
  g.append('g').attr('class', 'links')
  g.append('g').attr('class', 'nodes')

  // Setup zoom behavior
  zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform)
    })

  svg.call(zoom)

  // Setup tree layout (horizontal)
  treeLayout = d3.tree<BookmarkNode>()
    .nodeSize([30, 200])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.2))

  // Initial render
  update()
}

/**
 * Update visualization
 */
function update() {
  if (!g || !treeLayout) return

  const tree = currentTree.value
  if (tree.length === 0) return

  // Convert to hierarchy
  const root = d3.hierarchy<BookmarkNode>(
    {
      id: 'root',
      parentId: undefined,
      title: 'Root',
      url: null,
      addDate: 0,
      lastModified: 0,
      tags: [],
      isDuplicate: false,
      children: tree
    } as BookmarkNode
  )

  // Apply expansion state
  // Since d3.hierarchy creates a fully expanded tree by default,
  // we need to collapse nodes that are NOT in expandedNodes
  root.each(d => {
    if (d.depth > 0 && d.children) {
      // For large trees, collapse nodes at depth > 1 by default
      const shouldCollapse = isLargeTree.value
        ? (d.depth > 1 && !expandedNodes.value.has(d.data.id))
        : !expandedNodes.value.has(d.data.id)

      if (shouldCollapse) {
        ;(d as any)._children = d.children
        d.children = undefined
      }
    }
  })

  // Compute layout
  const treeData = treeLayout(root)

  // Get all nodes and links
  const nodes = treeData.descendants().filter(d => d.depth > 0) // Skip root
  const links = treeData.links().filter(d => d.target.depth > 0)

  // Center the tree
  const container = containerRef.value
  if (container) {
    const width = container.clientWidth
    const height = container.clientHeight
    const initialTransform = d3.zoomIdentity
      .translate(width / 4, height / 2)
    svg.call(zoom.transform, initialTransform)
  }

  // Update links
  updateLinks(links)

  // Update nodes
  updateNodes(nodes)
}

/**
 * Update links (connections between nodes)
 */
function updateLinks(links: d3.HierarchyPointLink<BookmarkNode>[]) {
  const linksGroup = g.select<SVGGElement>('.links')

  linksGroup
    .selectAll<SVGPathElement, d3.HierarchyPointLink<BookmarkNode>>('path')
    .data(links, (d: any) => d.target.data.id)
    .join(
      enter => enter.append('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 2)
        .attr('d', linkPath)
        .style('opacity', 0)
        .call(enter => enter.transition().duration(300).style('opacity', 1)),
      update => update
        .call(update => update.transition().duration(300).attr('d', linkPath)),
      exit => exit
        .call(exit => exit.transition().duration(300).style('opacity', 0).remove())
    )
}

/**
 * Generate link path (horizontal tree)
 */
function linkPath(d: d3.HierarchyPointLink<BookmarkNode>): string {
  return `M${d.source.y},${d.source.x}
          C${(d.source.y + d.target.y) / 2},${d.source.x}
           ${(d.source.y + d.target.y) / 2},${d.target.x}
           ${d.target.y},${d.target.x}`
}

/**
 * Update nodes
 */
function updateNodes(nodes: d3.HierarchyPointNode<BookmarkNode>[]) {
  const nodesGroup = g.select<SVGGElement>('.nodes')

  nodesGroup
    .selectAll<SVGGElement, d3.HierarchyPointNode<BookmarkNode>>('g.node')
    .data(nodes, (d: any) => d.data.id)
    .join(
      enter => {
        const nodeEnter = enter.append('g')
          .attr('class', 'node')
          .attr('transform', d => `translate(${d.y},${d.x})`)
          .style('opacity', 0)
          .style('cursor', 'pointer')

        // Add circle background
        nodeEnter.append('circle')
          .attr('r', 12)
          .attr('class', 'node-circle')
          .attr('fill', d => getNodeColor(d.data))
          .attr('stroke', d => getNodeStroke(d.data))
          .attr('stroke-width', d => searchResults.value.has(d.data.id) ? 3 : 2)

        // Add icon (base64 image or emoji)
        nodeEnter.each(function(d) {
          const node = d3.select(this)
          if (d.data.icon) {
            // Use base64 icon image
            node.append('image')
              .attr('class', 'node-icon')
              .attr('xlink:href', d.data.icon)
              .attr('x', -8)
              .attr('y', -8)
              .attr('width', 16)
              .attr('height', 16)
          } else {
            // Use emoji fallback
            node.append('text')
              .attr('class', 'node-icon')
              .attr('text-anchor', 'middle')
              .attr('dy', '0.35em')
              .attr('font-size', '14px')
              .text(getNodeIcon(d.data))
          }
        })

        // Add label
        nodeEnter.append('text')
          .attr('class', 'node-label')
          .attr('x', d => d.children || (d as any)._children ? -18 : 18)
          .attr('text-anchor', d => d.children || (d as any)._children ? 'end' : 'start')
          .attr('dy', '0.35em')
          .attr('font-size', '12px')
          .attr('fill', '#1e293b')
          .text(d => truncateText(d.data.title, 30))
          .style('pointer-events', 'none')

        // Add expand/collapse indicator
        nodeEnter.append('text')
          .attr('class', 'expand-indicator')
          .attr('x', 18)
          .attr('y', -10)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', '#64748b')
          .text(d => {
            if ((d as any)._children) return '+'
            if (d.children && d.children.length > 0) return '-'
            return ''
          })
          .style('pointer-events', 'none')

        // Event handlers
        nodeEnter
          .on('click', handleNodeClick)
          .on('contextmenu', handleNodeRightClick)
          .call(setupDrag())

        return nodeEnter.call(enter => enter.transition().duration(300).style('opacity', 1))
      },
      update => {
        update.select('.node-circle')
          .attr('fill', d => getNodeColor(d.data))
          .attr('stroke', d => getNodeStroke(d.data))
          .attr('stroke-width', d => searchResults.value.has(d.data.id) ? 3 : 2)

        // Update icon (handle both image and text)
        update.each(function(d) {
          const node = d3.select(this)
          const existingIcon = node.select('.node-icon')

          // Remove existing icon
          existingIcon.remove()

          // Add new icon based on type
          if (d.data.icon) {
            node.append('image')
              .attr('class', 'node-icon')
              .attr('xlink:href', d.data.icon)
              .attr('x', -8)
              .attr('y', -8)
              .attr('width', 16)
              .attr('height', 16)
          } else {
            node.append('text')
              .attr('class', 'node-icon')
              .attr('text-anchor', 'middle')
              .attr('dy', '0.35em')
              .attr('font-size', '14px')
              .text(getNodeIcon(d.data))
          }
        })

        update.select('.node-label')
          .attr('x', d => d.children || (d as any)._children ? -18 : 18)
          .attr('text-anchor', d => d.children || (d as any)._children ? 'end' : 'start')
          .text(d => truncateText(d.data.title, 30))

        update.select('.expand-indicator')
          .text(d => {
            if ((d as any)._children) return '+'
            if (d.children && d.children.length > 0) return '-'
            return ''
          })

        return update.call(update => update.transition().duration(300)
          .attr('transform', d => `translate(${d.y},${d.x})`))
      },
      exit => exit.call(exit => exit.transition().duration(300).style('opacity', 0).remove())
    )
}

/**
 * Get node color based on type and state
 */
function getNodeColor(node: BookmarkNode): string {
  if (node.isDuplicate) return '#fef3c7' // Yellow for duplicates
  if (searchResults.value.has(node.id)) return '#fef08a' // Highlight search results
  if (!node.url) return '#86efac' // Green for folders
  if (node.tags.length > 0) return '#bfdbfe' // Blue for tagged bookmarks
  return '#e0e7ff' // Default for bookmarks
}

/**
 * Get node stroke color
 */
function getNodeStroke(node: BookmarkNode): string {
  if (node.isDuplicate) return '#f59e0b'
  if (searchResults.value.has(node.id)) return '#eab308'
  if (!node.url) return '#22c55e'
  if (node.tags.length > 0) return '#3b82f6'
  return '#6366f1'
}

/**
 * Get node icon
 */
function getNodeIcon(node: BookmarkNode): string {
  if (!node.url) return '📁'
  return '📄'
}

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Handle node click (expand/collapse or open edit modal)
 */
function handleNodeClick(event: MouseEvent, d: d3.HierarchyPointNode<BookmarkNode>) {
  event.stopPropagation()

  const node = d.data

  // If folder, toggle expansion
  if (!node.url) {
    uiStore.toggleNodeExpansion(node.id)
    update()
  } else {
    // If bookmark, open edit modal
    uiStore.openEditBookmark(node)
  }
}

/**
 * Handle node right click (context menu)
 */
function handleNodeRightClick(event: MouseEvent, d: d3.HierarchyPointNode<BookmarkNode>) {
  event.preventDefault()
  event.stopPropagation()

  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    node: d.data
  }
}

/**
 * Close context menu
 */
function closeContextMenu() {
  contextMenu.value.visible = false
  contextMenu.value.node = null
}

/**
 * Handle context menu actions
 */
function handleContextMenuAction(action: 'edit' | 'delete' | 'rename') {
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

/**
 * Setup drag behavior with ghost node pattern
 */
function setupDrag() {
  return d3.drag<SVGGElement, d3.HierarchyPointNode<BookmarkNode>>()
    .container(function() {
      // Set container to the zoom group for proper coordinate transformation
      return g.node() as any
    })
    .on('start', function(_event, d) {
      draggedNode = d

      // Reduce opacity of original node
      d3.select(this).style('opacity', 0.3)

      // Create ghost node (clone of the dragged node)
      ghostNode = g.append('g')
        .attr('class', 'ghost-node')
        .attr('transform', `translate(${d.y},${d.x})`)
        .style('pointer-events', 'none')
        .style('opacity', 0.7)

      // Clone circle
      ghostNode.append('circle')
        .attr('r', 12)
        .attr('fill', getNodeColor(d.data))
        .attr('stroke', getNodeStroke(d.data))
        .attr('stroke-width', 2)

      // Clone icon (base64 image or emoji)
      if (d.data.icon) {
        ghostNode.append('image')
          .attr('xlink:href', d.data.icon)
          .attr('x', -8)
          .attr('y', -8)
          .attr('width', 16)
          .attr('height', 16)
      } else {
        ghostNode.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', '14px')
          .text(getNodeIcon(d.data))
      }

      // Clone label
      ghostNode.append('text')
        .attr('x', d.children || (d as any)._children ? -18 : 18)
        .attr('text-anchor', d.children || (d as any)._children ? 'end' : 'start')
        .attr('dy', '0.35em')
        .attr('font-size', '12px')
        .attr('fill', '#1e293b')
        .text(truncateText(d.data.title, 30))
    })
    .on('drag', function(event, d) {
      // Update ghost node position
      // event.x and event.y are already in the container's (g's) coordinate system
      if (ghostNode) {
        ghostNode.attr('transform', `translate(${event.x},${event.y})`)
      }

      // Find potential drop target
      const nodes = g.selectAll<SVGGElement, d3.HierarchyPointNode<BookmarkNode>>('g.node')
      let closestFolder: d3.HierarchyPointNode<BookmarkNode> | null = null
      let minDistance = Infinity

      nodes.each(function(node) {
        // Only consider folders (not the dragged node itself)
        if (node.data.id !== d.data.id && !node.data.url) {
          // Calculate distance from ghost position to this node
          const distance = Math.sqrt((event.x - node.y) ** 2 + (event.y - node.x) ** 2)
          if (distance < 50 && distance < minDistance) {
            minDistance = distance
            closestFolder = node
          }
        }
      })

      // Highlight drop target
      nodes.selectAll('.node-circle')
        .attr('stroke-width', (node: any) => {
          if (closestFolder && node.data.id === closestFolder.data.id) {
            return 4
          }
          return searchResults.value.has(node.data.id) ? 3 : 2
        })

      dropTarget = closestFolder
    })
    .on('end', async function(_event, _d) {
      // Remove ghost node
      if (ghostNode) {
        ghostNode.remove()
        ghostNode = null
      }

      // Reset opacity of original node
      d3.select(this).style('opacity', 1)

      // Reset stroke widths
      g.selectAll('.node-circle')
        .attr('stroke-width', (node: any) => searchResults.value.has(node.data.id) ? 3 : 2)

      // Handle drop
      if (dropTarget && draggedNode) {
        try {
          await bookmarkStore.moveNode(draggedNode.data.id, dropTarget.data.id)
          message.success(`Moved "${draggedNode.data.title}" to "${dropTarget.data.title}"`)
          update()
        } catch (error) {
          message.error(`Failed to move node: ${error}`)
        }
      }

      draggedNode = null
      dropTarget = null
    })
}

/**
 * Handle window resize
 */
function handleResize() {
  if (!containerRef.value || !svgRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  svg.attr('width', width).attr('height', height)
  update()
}

// Watch for tree changes
watch(currentTree, () => {
  nextTick(() => update())
}, { deep: true })

// Watch for search query changes
watch(searchQuery, () => {
  update()
})

// Watch for expansion changes
watch(() => uiStore.expandedNodes, () => {
  update()
}, { deep: true })

// Lifecycle
onMounted(() => {
  initD3()
  window.addEventListener('resize', handleResize)
  window.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', closeContextMenu)
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full overflow-hidden relative bg-white rounded-lg shadow">
    <svg ref="svgRef" class="w-full h-full"></svg>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      :style="{
        position: 'fixed',
        left: contextMenu.x + 'px',
        top: contextMenu.y + 'px',
        zIndex: 1000
      }"
      class="bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]"
    >
      <div
        class="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
        @click="handleContextMenuAction('edit')"
      >
        Edit
      </div>
      <div
        class="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
        @click="handleContextMenuAction('rename')"
      >
        Rename
      </div>
      <div
        class="px-4 py-2 hover:bg-red-50 cursor-pointer text-sm text-red-600"
        @click="handleContextMenuAction('delete')"
      >
        Delete
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="currentTree.length === 0"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-center text-gray-500">
        <div class="text-4xl mb-4">📚</div>
        <div class="text-lg font-medium">No bookmarks to display</div>
        <div class="text-sm mt-2">Upload a bookmark file to get started</div>
      </div>
    </div>

    <!-- Legend -->
    <div
      v-if="currentTree.length > 0"
      class="absolute top-4 right-4 bg-white rounded-lg shadow-md border border-gray-200 p-3 text-xs"
    >
      <div class="font-semibold mb-2 text-gray-700">Legend</div>
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-green-300 border-2 border-green-500"></div>
          <span>Folder</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-indigo-200 border-2 border-indigo-500"></div>
          <span>Bookmark</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-blue-200 border-2 border-blue-500"></div>
          <span>Tagged</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-yellow-200 border-2 border-yellow-500"></div>
          <span>Duplicate</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-yellow-300 border-3 border-yellow-500"></div>
          <span>Search Result</span>
        </div>
      </div>
      <div class="mt-3 pt-2 border-t border-gray-200 text-gray-600">
        <div>Click folder to expand/collapse</div>
        <div>Click bookmark to edit</div>
        <div>Right-click for menu</div>
        <div>Drag to move nodes</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styles if needed */
</style>
