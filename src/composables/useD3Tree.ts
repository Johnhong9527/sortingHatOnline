/**
 * D3 Mind Map Visualization Composable
 * Optimized mind-map style with clean node display
 */

import { Ref, watch, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { BookmarkNode } from '@/utils/wasmBridge'

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  data: BookmarkNode
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: D3Node
  target: D3Node
}

export function useD3Tree(
  containerRef: Ref<HTMLElement | null>,
  data: Ref<BookmarkNode[]>,
  searchResults: Ref<string[]>,
  onNodeClick?: (node: BookmarkNode) => void
) {
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
  let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
  let simulation: d3.Simulation<D3Node, D3Link> | null = null
  // let selectedNodeId: string | null = null

  // Track collapsed folders
  const collapsedFolders = new Set<string>()

  const width = 1600
  const height = 1000

  /**
   * Initialize SVG canvas
   */
  function initSVG() {
    if (!containerRef.value) return

    // Clear existing SVG
    d3.select(containerRef.value).selectAll('*').remove()

    // Create SVG
    svg = d3
      .select(containerRef.value)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', '#fafafa')

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g?.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create main group
    g = svg.append('g')

    // Center initial view
    svg.call(
      zoom.transform as any,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
    )
  }

  /**
   * Check if a node should be visible (not hidden by collapsed parent)
   */
  function isNodeVisible(nodeId: string, nodes: D3Node[]): boolean {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return false

    // Check if any ancestor is collapsed
    let current = node
    while (current.data.parentId) {
      if (collapsedFolders.has(current.data.parentId)) {
        return false
      }
      current = nodes.find(n => n.id === current.data.parentId)!
      if (!current) break
    }
    return true
  }

  /**
   * Get all descendant node IDs
   */
  // function getDescendants(nodeId: string, nodes: D3Node[]): string[] {
  //   const descendants: string[] = []
  //   const children = nodes.filter(n => n.data.parentId === nodeId)

  //   for (const child of children) {
  //     descendants.push(child.id)
  //     descendants.push(...getDescendants(child.id, nodes))
  //   }

  //   return descendants
  // }

  /**
   * Convert flat bookmark data to graph structure
   */
  function buildGraph(bookmarks: BookmarkNode[]): { nodes: D3Node[]; links: D3Link[] } {
    const nodes: D3Node[] = []
    const links: D3Link[] = []
    const nodeMap = new Map<string, D3Node>()

    // Create nodes
    bookmarks.forEach(bookmark => {
      const node: D3Node = {
        id: bookmark.id,
        data: bookmark,
      }
      nodes.push(node)
      nodeMap.set(bookmark.id, node)
    })

    // Create links based on parent-child relationships
    bookmarks.forEach(bookmark => {
      if (bookmark.parentId) {
        const parent = nodeMap.get(bookmark.parentId)
        const child = nodeMap.get(bookmark.id)
        if (parent && child) {
          links.push({ source: parent, target: child })
        }
      }
    })

    return { nodes, links }
  }

  /**
   * Render mind-map style graph
   */
  function render() {
    if (!g || !data.value || data.value.length === 0) return

    // Build graph structure
    const { nodes, links } = buildGraph(data.value)

    if (nodes.length === 0) return

    // Filter visible nodes and links
    const visibleNodes = nodes.filter(n => isNodeVisible(n.id, nodes))
    const visibleLinks = links.filter(l => {
      const source = l.source as D3Node
      const target = l.target as D3Node
      return isNodeVisible(source.id, nodes) && isNodeVisible(target.id, nodes)
    })

    console.log('Rendering graph:', {
      nodeCount: nodes.length,
      linkCount: links.length,
      visibleNodes: visibleNodes.length,
      visibleLinks: visibleLinks.length
    })

    // Create force simulation
    simulation = d3.forceSimulation<D3Node>(visibleNodes)
      .force('link', d3.forceLink<D3Node, D3Link>(visibleLinks)
        .id(d => d.id)
        .distance(80)
        .strength(0.7)
      )
      .force('charge', d3.forceManyBody()
        .strength(-200)
        .distanceMax(300)
      )
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide()
        .radius(25)
        .strength(0.9)
      )
      .force('x', d3.forceX(0).strength(0.02))
      .force('y', d3.forceY(0).strength(0.02))

    // Clear previous elements
    g.selectAll('.links').remove()
    g.selectAll('.nodes').remove()

    // Create link group (render first so nodes appear on top)
    const linkGroup = g.append('g').attr('class', 'links')

    // Create node group
    const nodeGroup = g.append('g').attr('class', 'nodes')

    // Render links with curved paths
    const link = linkGroup.selectAll<SVGPathElement, D3Link>('.link')
      .data(visibleLinks)
      .join('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#999')
      .attr('stroke-width', 3)
      .attr('stroke-opacity', 0.8)

    // Render nodes
    const node = nodeGroup.selectAll<SVGGElement, D3Node>('.node')
      .data(visibleNodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(drag(simulation) as any)

    // Add main circle for each node
    node.append('circle')
      .attr('r', 20)
      .attr('fill', d => {
        if (searchResults.value.includes(d.id)) {
          return '#fff7e6' // Light yellow for search results
        }
        return d.data.url ? '#e6f7ff' : '#f6ffed'
      })
      .attr('stroke', d => {
        if (d.data.isDuplicate) return '#ff4d4f'
        if (searchResults.value.includes(d.id)) return '#faad14'
        return d.data.url ? '#1890ff' : '#52c41a'
      })
      .attr('stroke-width', d => d.data.isDuplicate ? 3 : 2)

    // Add icon/emoji for each node type
    node.append('text')
      .text(d => {
        if (d.data.url) {
          return '🔖' // Bookmark icon
        } else {
          // Check if folder has children
          const hasChildren = nodes.some(n => n.data.parentId === d.id)
          if (hasChildren) {
            return collapsedFolders.has(d.id) ? '📁' : '📂' // Closed/Open folder
          }
          return '📄' // Empty folder
        }
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '20px')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // Add expand/collapse indicator for folders with children
    const expandButton = node.filter(d => !d.data.url && nodes.some(n => n.data.parentId === d.id))
      .append('g')
      .attr('class', 'expand-button')
      .style('cursor', 'pointer')

    expandButton
      .append('circle')
      .attr('cx', 14)
      .attr('cy', 14)
      .attr('r', 6)
      .attr('fill', '#fff')
      .attr('stroke', '#1890ff')
      .attr('stroke-width', 2)

    expandButton
      .append('text')
      .text(d => collapsedFolders.has(d.id) ? '+' : '−')
      .attr('x', 14)
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#1890ff')
      .style('pointer-events', 'none')

    // Add click handler for expand/collapse button
    expandButton.on('click', (event, d) => {
      event.stopPropagation()

      if (collapsedFolders.has(d.id)) {
        collapsedFolders.delete(d.id)
      } else {
        collapsedFolders.add(d.id)
      }

      // Re-render to show/hide children
      render()
    })

    // Add small badge for tags
    node.filter(d => d.data.tags.length > 0)
      .append('circle')
      .attr('cx', -14)
      .attr('cy', -14)
      .attr('r', 8)
      .attr('fill', '#1890ff')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    node.filter(d => d.data.tags.length > 0)
      .append('text')
      .text(d => d.data.tags.length)
      .attr('x', -14)
      .attr('y', -14)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#fff')
      .style('pointer-events', 'none')

    // Add duplicate indicator
    node.filter(d => d.data.isDuplicate)
      .append('circle')
      .attr('cx', -14)
      .attr('cy', 14)
      .attr('r', 6)
      .attr('fill', '#ff4d4f')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Add click handler for node (show details)
    node.on('click', (event, d) => {
      event.stopPropagation()

      // Update selection state
      // selectedNodeId = d.id

      // Update visual state - add glow effect
      node.select('circle:first-child')
        .attr('stroke-width', n => n.id === d.id ? 4 : (n.data.isDuplicate ? 3 : 2))
        .attr('filter', n => n.id === d.id ? 'drop-shadow(0 0 8px rgba(24, 144, 255, 0.6))' : 'none')

      // Call callback to show details panel
      if (onNodeClick) {
        onNodeClick(d.data)
      }
    })

    // Add double-click to open URL
    node.filter(d => !!d.data.url)
      .on('dblclick', (event, d) => {
        event.stopPropagation()
        if (d.data.url) {
          window.open(d.data.url, '_blank')
        }
      })

    // Update positions on simulation tick
    simulation.on('tick', () => {
      // Update curved links
      link.attr('d', d => {
        const source = d.source as D3Node
        const target = d.target as D3Node
        const dx = (target.x || 0) - (source.x || 0)
        const dy = (target.y || 0) - (source.y || 0)
        const dr = Math.sqrt(dx * dx + dy * dy) * 0.5

        return `M${source.x || 0},${source.y || 0}A${dr},${dr} 0 0,1 ${target.x || 0},${target.y || 0}`
      })

      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`)
    })
  }

  /**
   * Drag behavior for nodes
   */
  function drag(simulation: d3.Simulation<D3Node, D3Link>) {
    function dragstarted(event: any, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: D3Node) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return d3.drag<SVGGElement, D3Node>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
  }

  /**
   * Watch for data changes
   */
  watch([data, searchResults], () => {
    if (containerRef.value && data.value.length > 0) {
      render()
    }
  }, { deep: true })

  /**
   * Initialize on mount
   */
  watch(containerRef, (newVal) => {
    if (newVal) {
      initSVG()
      if (data.value.length > 0) {
        render()
      }
    }
  }, { immediate: true })

  /**
   * Cleanup on unmount
   */
  onUnmounted(() => {
    if (simulation) {
      simulation.stop()
    }
    if (containerRef.value) {
      d3.select(containerRef.value).selectAll('*').remove()
    }
  })

  return {
    render,
  }
}
