/**
 * Canvas-based Tree Visualization Composable
 * Migrated from BookmarkTree.vue with Canvas rendering
 */

import { Ref, watch, onUnmounted, nextTick } from 'vue'
import * as d3 from 'd3'
import type { BookmarkNode } from '@/utils/wasmBridge'

interface CanvasNode extends d3.HierarchyPointNode<BookmarkNode> {
  _children?: CanvasNode[]
}

interface Transform {
  x: number
  y: number
  k: number
}

interface DragState {
  isDragging: boolean
  draggedNode: CanvasNode | null
  dropTarget: CanvasNode | null
  dropZone: 'before' | 'after' | 'inside' | null
  ghostX: number
  ghostY: number
}

export function useCanvasTree(
  containerRef: Ref<HTMLElement | null>,
  treeData: Ref<BookmarkNode[]>,
  expandedNodes: Ref<Set<string>>,
  searchResults: Ref<Set<string>>,
  onNodeClick?: (node: BookmarkNode, event: MouseEvent) => void,
  onNodeRightClick?: (node: BookmarkNode, event: MouseEvent) => void,
  onNodeMove?: (nodeId: string, targetId: string, position?: 'before' | 'after' | 'inside') => Promise<void>,
  onExpandNodes?: (nodeIds: string[]) => void
) {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let animationFrameId: number | null = null

  // Tree state
  let root: CanvasNode | null = null
  let nodes: CanvasNode[] = []
  let links: d3.HierarchyPointLink<BookmarkNode>[] = []
  let treeLayout: d3.TreeLayout<BookmarkNode> | null = null

  // Transform state (zoom/pan)
  let transform: Transform = { x: 0, y: 0, k: 1 }

  // Drag state
  let dragState: DragState = {
    isDragging: false,
    draggedNode: null,
    dropTarget: null,
    dropZone: null,
    ghostX: 0,
    ghostY: 0
  }

  // Icon cache for base64 images
  const iconCache = new Map<string, HTMLImageElement>()

  // Track if we've initialized default expansion state
  let hasInitializedExpansion = false

  // Mouse state
  let mouseX = 0
  let mouseY = 0
  let isPanning = false
  let panStartX = 0
  let panStartY = 0
  let panStartTransformX = 0
  let panStartTransformY = 0
  let isSpacePressed = false


  /**
   * Resize canvas to match container
   */
  function resizeCanvas() {
    if (!containerRef.value || !canvas) return

    const container = containerRef.value
    const width = container.clientWidth
    const height = container.clientHeight

    if (width > 0 && height > 0) {
      canvas.width = width
      canvas.height = height
      update()
    }
  }

  /**
   * Initialize Canvas
   */
  function initCanvas() {
    if (!containerRef.value) return

    const container = containerRef.value
    const width = container.clientWidth
    const height = container.clientHeight

    // Create canvas element
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.cursor = 'grab'

    ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear container and append canvas
    container.innerHTML = ''
    container.appendChild(canvas)

    // Setup tree layout (horizontal)
    treeLayout = d3.tree<BookmarkNode>()
      .nodeSize([30, 200])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2))

    // Setup event listeners
    setupEventListeners()

    // Initial transform (center the tree)
    transform = {
      x: width / 4,
      y: height / 2,
      k: 1
    }

    // Initial render
    update()
  }

  /**
   * Setup event listeners for interaction
   */
  function setupEventListeners() {
    if (!canvas) return

    // Mouse move
    canvas.addEventListener('mousemove', handleMouseMove)

    // Mouse down
    canvas.addEventListener('mousedown', handleMouseDown)

    // Mouse up
    canvas.addEventListener('mouseup', handleMouseUp)

    // Mouse wheel (zoom)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    // Context menu
    canvas.addEventListener('contextmenu', handleContextMenu)

    // Keyboard events (for space key panning)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  }

  /**
   * Handle key down
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.code === 'Space' && !isSpacePressed) {
      event.preventDefault()
      isSpacePressed = true
      if (canvas) {
        canvas.style.cursor = 'grab'
      }
    }
  }

  /**
   * Handle key up
   */
  function handleKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') {
      event.preventDefault()
      isSpacePressed = false
      if (canvas && !isPanning) {
        canvas.style.cursor = 'grab'
      }
    }
  }

  /**
   * Handle mouse move
   */
  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    mouseX = event.clientX - rect.left
    mouseY = event.clientY - rect.top

    if (isPanning) {
      // Pan the canvas
      const dx = event.clientX - panStartX
      const dy = event.clientY - panStartY
      transform.x = panStartTransformX + dx
      transform.y = panStartTransformY + dy
      render()
    } else if (dragState.isDragging && dragState.draggedNode) {
      // Update ghost position
      const worldPos = screenToWorld(mouseX, mouseY)
      dragState.ghostX = worldPos.x
      dragState.ghostY = worldPos.y

      // Find drop target with zone
      const dropInfo = findDropTargetWithZone(worldPos.x, worldPos.y)
      dragState.dropTarget = dropInfo.target
      dragState.dropZone = dropInfo.zone

      render()
    } else {
      // Update cursor based on hover
      if (isSpacePressed) {
        canvas.style.cursor = 'grab'
      } else {
        const worldPos = screenToWorld(mouseX, mouseY)
        const hoveredNode = findNodeAtPosition(worldPos.x, worldPos.y)
        canvas.style.cursor = hoveredNode ? 'pointer' : 'grab'
      }
    }
  }

  /**
   * Handle mouse down
   */
  function handleMouseDown(event: MouseEvent) {
    if (!canvas || event.button !== 0) return

    const rect = canvas.getBoundingClientRect()
    mouseX = event.clientX - rect.left
    mouseY = event.clientY - rect.top

    // If space is pressed, always pan
    if (isSpacePressed) {
      isPanning = true
      panStartX = event.clientX
      panStartY = event.clientY
      panStartTransformX = transform.x
      panStartTransformY = transform.y
      canvas.style.cursor = 'grabbing'
      return
    }

    const worldPos = screenToWorld(mouseX, mouseY)
    const clickedNode = findNodeAtPosition(worldPos.x, worldPos.y)

    if (clickedNode) {
      // Start dragging node
      dragState.isDragging = true
      dragState.draggedNode = clickedNode
      dragState.ghostX = clickedNode.y
      dragState.ghostY = clickedNode.x
      canvas.style.cursor = 'grabbing'
    } else {
      // Start panning
      isPanning = true
      panStartX = event.clientX
      panStartY = event.clientY
      panStartTransformX = transform.x
      panStartTransformY = transform.y
      canvas.style.cursor = 'grabbing'
    }
  }

  /**
   * Handle mouse up
   */
  async function handleMouseUp(event: MouseEvent) {
    if (!canvas) return

    if (dragState.isDragging && dragState.draggedNode) {
      // Handle drop
      if (dragState.dropTarget && dragState.dropZone && onNodeMove) {
        try {
          const draggedId = dragState.draggedNode.data.id
          const targetId = dragState.dropTarget.data.id
          const position = dragState.dropZone

          // Call onNodeMove with the position parameter
          await onNodeMove(draggedId, targetId, position)

          // Reset drag state first
          dragState.isDragging = false
          dragState.draggedNode = null
          dragState.dropTarget = null
          dragState.dropZone = null

          // Update tree structure and re-render
          // The watch on treeData should trigger update(), but we call it explicitly to ensure
          await nextTick()
          update()
        } catch (error) {
          console.error('Failed to move node:', error)
          // Reset drag state on error
          dragState.isDragging = false
          dragState.draggedNode = null
          dragState.dropTarget = null
          dragState.dropZone = null
          render()
        }
      } else if (!dragState.dropTarget) {
        // Click event (no drag occurred)
        const rect = canvas.getBoundingClientRect()
        const clickX = event.clientX - rect.left
        const clickY = event.clientY - rect.top
        const worldPos = screenToWorld(clickX, clickY)
        const clickedNode = findNodeAtPosition(worldPos.x, worldPos.y)

        if (clickedNode && onNodeClick) {
          onNodeClick(clickedNode.data, event)
        }

        // Reset drag state
        dragState.isDragging = false
        dragState.draggedNode = null
        dragState.dropTarget = null
        dragState.dropZone = null
        render()
      } else {
        // No valid drop target, just reset
        dragState.isDragging = false
        dragState.draggedNode = null
        dragState.dropTarget = null
        dragState.dropZone = null
        render()
      }

      canvas.style.cursor = isSpacePressed ? 'grab' : 'grab'
    } else if (isPanning) {
      // End panning
      isPanning = false
      canvas.style.cursor = isSpacePressed ? 'grab' : 'grab'
    }
  }

  /**
   * Handle mouse wheel (zoom)
   */
  function handleWheel(event: WheelEvent) {
    event.preventDefault()
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    // Zoom factor
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(3, transform.k * zoomFactor))

    // Zoom towards mouse position
    const worldBefore = screenToWorld(mouseX, mouseY)
    transform.k = newScale
    const worldAfter = screenToWorld(mouseX, mouseY)

    transform.x += (worldAfter.x - worldBefore.x) * transform.k
    transform.y += (worldAfter.y - worldBefore.y) * transform.k

    render()
  }

  /**
   * Handle context menu
   */
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault()
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top
    const worldPos = screenToWorld(clickX, clickY)
    const clickedNode = findNodeAtPosition(worldPos.x, worldPos.y)

    if (clickedNode && onNodeRightClick) {
      onNodeRightClick(clickedNode.data, event)
    }
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - transform.x) / transform.k,
      y: (screenY - transform.y) / transform.k
    }
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  // function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  //   return {
  //     x: worldX * transform.k + transform.x,
  //     y: worldY * transform.k + transform.y
  //   }
  // }

  /**
   * Find node at position
   */
  function findNodeAtPosition(worldX: number, worldY: number): CanvasNode | null {
    for (const node of nodes) {
      const dx = worldX - node.y
      const dy = worldY - node.x
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < 12) {
        return node
      }
    }
    return null
  }

  /**
   * Find drop target with zone detection (before, after, inside)
   */
  function findDropTargetWithZone(worldX: number, worldY: number): { target: CanvasNode | null; zone: 'before' | 'after' | 'inside' | null } {
    let closestNode: CanvasNode | null = null
    let minDistance = Infinity
    let zone: 'before' | 'after' | 'inside' | null = null

    for (const node of nodes) {
      // Skip the dragged node itself
      if (node === dragState.draggedNode) continue

      const dx = worldX - node.y
      const dy = worldY - node.x
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < 80 && distance < minDistance) {
        minDistance = distance
        closestNode = node

        // Determine drop zone based on position
        if (!node.data.url) {
          // For folders, check if dropping inside or before/after
          if (Math.abs(dx) < 30) {
            // Close to the node horizontally - drop inside
            zone = 'inside'
          } else if (dy < -15) {
            // Above the node - drop before
            zone = 'before'
          } else if (dy > 15) {
            // Below the node - drop after
            zone = 'after'
          } else {
            // Default to inside for folders
            zone = 'inside'
          }
        } else {
          // For bookmarks, only allow before/after (same level)
          if (dy < 0) {
            zone = 'before'
          } else {
            zone = 'after'
          }
        }
      }
    }

    return { target: closestNode, zone }
  }

  /**
   * Find drop target (folder only) - legacy function for backward compatibility
   */
  // function findDropTarget(worldX: number, worldY: number): CanvasNode | null {
  //   const result = findDropTargetWithZone(worldX, worldY)
  //   return result.zone === 'inside' ? result.target : null
  // }

  /**
   * Update tree structure and layout
   */
  function update() {
    if (!treeLayout || treeData.value.length === 0) return

    // Convert to hierarchy
    root = d3.hierarchy<BookmarkNode>(
      {
        id: 'root',
        parentId: undefined,
        title: 'Root',
        url: null,
        addDate: 0,
        lastModified: 0,
        tags: [],
        isDuplicate: false,
        children: treeData.value
      } as BookmarkNode
    ) as CanvasNode

    // Check if tree is large (>2000 nodes)
    const isLargeTree = root.descendants().length > 2000

    // Initialize default expansion state: expand all folder nodes by default
    // Only initialize once on first load (when expandedNodes is empty and we haven't initialized yet)
    if (!hasInitializedExpansion && treeData.value.length > 0 && expandedNodes.value.size === 0) {
      // Collect all folder nodes (nodes without URL) and add them to expandedNodes
      const folderIds: string[] = []
      function collectFolderNodes(node: CanvasNode) {
        if (node.depth > 0 && !node.data.url) {
          folderIds.push(node.data.id)
        }
        if (node.children) {
          node.children.forEach(collectFolderNodes)
        }
      }
      root.children?.forEach(collectFolderNodes)

      console.log('🎯 Initializing expandedNodes with folder IDs:', folderIds)
      // Use callback to update expandedNodes instead of direct assignment
      if (onExpandNodes) {
        onExpandNodes(folderIds)
      }
      hasInitializedExpansion = true

      // Return early - the watcher will trigger update() again with the new expandedNodes
      return
    }

    // Apply expansion state
    // Handle both expanding and collapsing nodes based on expandedNodes
    root.each((d: CanvasNode) => {
      if (d.depth > 0) {
        const isExpanded = expandedNodes.value.has(d.data.id)
        console.log(`🔍 Node ${d.data.title} (${d.data.id}): isExpanded=${isExpanded}, has children=${!!d.children}, has _children=${!!d._children}`)

        if (isLargeTree) {
          // For large trees, collapse nodes at depth > 1 unless explicitly expanded
          const shouldBeExpanded = d.depth <= 1 || isExpanded

          if (shouldBeExpanded && d._children) {
            // Expand: restore children from _children
            console.log(`✅ Expanding node: ${d.data.title}`)
            d.children = d._children as any
            d._children = undefined
          } else if (!shouldBeExpanded && d.children) {
            // Collapse: move children to _children
            console.log(`❌ Collapsing node: ${d.data.title}`)
            d._children = d.children as CanvasNode[]
            d.children = undefined
          }
        } else {
          // For small trees, expand if in expandedNodes
          if (isExpanded && d._children) {
            // Expand: restore children from _children
            console.log(`✅ Expanding node: ${d.data.title}`)
            d.children = d._children as any
            d._children = undefined
          } else if (!isExpanded && d.children) {
            // Collapse: move children to _children
            console.log(`❌ Collapsing node: ${d.data.title}`)
            d._children = d.children as CanvasNode[]
            d.children = undefined
          }
        }
      }
    })

    // Compute layout
    const layoutResult = treeLayout(root)

    // Get all nodes and links (skip root)
    nodes = layoutResult.descendants().filter(d => d.depth > 0) as CanvasNode[]
    links = layoutResult.links().filter(d => d.target.depth > 0)

    render()
  }

  /**
   * Render the tree on canvas
   */
  function render() {
    if (!ctx || !canvas) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply transform
    ctx.save()
    ctx.translate(transform.x, transform.y)
    ctx.scale(transform.k, transform.k)

    // Render links
    renderLinks()

    // Render nodes
    renderNodes()

    // Render ghost node if dragging
    if (dragState.isDragging && dragState.draggedNode) {
      renderGhostNode()
    }

    ctx.restore()
  }

  /**
   * Render links (connections between nodes)
   */
  function renderLinks() {
    if (!ctx) return

    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 2 / transform.k

    for (const link of links) {
      const source = link.source as CanvasNode
      const target = link.target as CanvasNode

      ctx.beginPath()
      ctx.moveTo(source.y, source.x)

      // Bezier curve for smooth connection
      const midX = (source.y + target.y) / 2
      ctx.bezierCurveTo(
        midX, source.x,
        midX, target.x,
        target.y, target.x
      )

      ctx.stroke()
    }
  }

  /**
   * Render nodes
   */
  function renderNodes() {
    if (!ctx) return

    for (const node of nodes) {
      // Skip if being dragged
      if (dragState.isDragging && node === dragState.draggedNode) {
        continue
      }

      renderNode(node, false)

      // Render drop zone indicator
      if (dragState.isDragging && dragState.dropTarget === node && dragState.dropZone) {
        renderDropZoneIndicator(node, dragState.dropZone)
      }
    }
  }

  /**
   * Render drop zone indicator
   */
  function renderDropZoneIndicator(node: CanvasNode, zone: 'before' | 'after' | 'inside') {
    if (!ctx) return

    const x = node.y
    const y = node.x

    ctx.save()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3 / transform.k
    ctx.setLineDash([5 / transform.k, 5 / transform.k])

    if (zone === 'inside') {
      // Draw a circle around the node
      ctx.beginPath()
      ctx.arc(x, y, 18, 0, 2 * Math.PI)
      ctx.stroke()
    } else if (zone === 'before') {
      // Draw a line above the node
      ctx.beginPath()
      ctx.moveTo(x - 30, y - 15)
      ctx.lineTo(x + 30, y - 15)
      ctx.stroke()
    } else if (zone === 'after') {
      // Draw a line below the node
      ctx.beginPath()
      ctx.moveTo(x - 30, y + 15)
      ctx.lineTo(x + 30, y + 15)
      ctx.stroke()
    }

    ctx.restore()
  }

  /**
   * Render a single node
   */
  function renderNode(node: CanvasNode, isGhost: boolean) {
    if (!ctx) return

    const x = node.y
    const y = node.x
    const radius = 12

    // Determine colors
    const fillColor = getNodeColor(node.data)
    const strokeColor = getNodeStroke(node.data)
    const strokeWidth = searchResults.value.has(node.data.id) ? 3 : 2

    // Draw circle
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = fillColor
    ctx.fill()
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth / transform.k
    ctx.stroke()

    // Draw icon
    if (node.data.icon) {
      // Draw base64 icon
      drawIcon(node.data.icon, x, y, 16)
    } else {
      // Draw emoji fallback
      const icon = getNodeIcon(node.data)
      ctx.font = `${14 / transform.k}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#000'
      ctx.fillText(icon, x, y)
    }

    // Draw label
    const labelX = node.children || node._children ? x - 18 : x + 18
    const labelAlign = node.children || node._children ? 'right' : 'left'
    ctx.font = `${12 / transform.k}px sans-serif`
    ctx.textAlign = labelAlign
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1e293b'
    ctx.fillText(truncateText(node.data.title, 24), labelX, y)

    // Draw expand/collapse indicator
    if (node._children || (node.children && node.children.length > 0)) {
      const indicator = node._children ? '+' : '-'
      ctx.font = `${10 / transform.k}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#64748b'
      ctx.fillText(indicator, x + 18, y - 10)
    }

    // Apply ghost opacity
    if (isGhost) {
      ctx.globalAlpha = 0.7
    }
  }

  /**
   * Render ghost node during drag
   */
  function renderGhostNode() {
    if (!ctx || !dragState.draggedNode) return

    ctx.save()
    ctx.globalAlpha = 0.7

    // Create a temporary node for rendering
    const ghostNode = {
      ...dragState.draggedNode,
      y: dragState.ghostX,
      x: dragState.ghostY
    } as CanvasNode

    renderNode(ghostNode, true)

    ctx.restore()
  }

  /**
   * Draw base64 icon
   */
  function drawIcon(iconData: string, x: number, y: number, size: number) {
    if (!ctx) return

    // Check cache
    let img = iconCache.get(iconData)

    if (!img) {
      // Create and cache image
      img = new Image()
      img.src = iconData
      iconCache.set(iconData, img)

      // Render when loaded
      img.onload = () => {
        render()
      }
    }

    // Draw if loaded
    if (img.complete) {
      const scaledSize = size / transform.k
      ctx.drawImage(img, x - scaledSize / 2, y - scaledSize / 2, scaledSize, scaledSize)
    }
  }

  /**
   * Get node color based on type and state
   */
  function getNodeColor(node: BookmarkNode): string {
    if (node.isDuplicate) return '#fef3c7'
    if (searchResults.value.has(node.id)) return '#fef08a'
    if (!node.url) return '#86efac'
    if (node.tags.length > 0) return '#bfdbfe'
    return '#e0e7ff'
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
   * Watch for data changes
   */
  watch(treeData, (newTreeData, oldTreeData) => {
    console.log('🎨 Canvas watcher triggered (treeData), tree length:', newTreeData.length)
    // Reset initialization flag if tree data changed significantly
    if (oldTreeData && (newTreeData.length !== oldTreeData.length || 
        JSON.stringify(newTreeData.map(n => n.id)) !== JSON.stringify(oldTreeData.map(n => n.id)))) {
      hasInitializedExpansion = false
    }
    update()
  }, { deep: true })

  watch(expandedNodes, (newVal) => {
    console.log('🎨 Canvas watcher triggered (expandedNodes)')
    console.log('📊 expandedNodes size:', newVal.size)
    console.log('📊 expandedNodes:', Array.from(newVal))
    update()
  }, { deep: true })

  watch(searchResults, () => {
    console.log('🎨 Canvas watcher triggered (searchResults)')
    update()
  })

  /**
   * Initialize on mount
   */
  watch(containerRef, (newVal) => {
    if (newVal) {
      initCanvas()
    }
  }, { immediate: true })

  /**
   * Cleanup on unmount
   */
  onUnmounted(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
    if (canvas) {
      canvas.remove()
    }
    // Remove keyboard event listeners
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  })

  return {
    update,
    render,
    resizeCanvas
  }
}
