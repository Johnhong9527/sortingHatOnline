// Test multilevel parsing
import { wasmBridge } from './src/utils/wasmBridge'
import * as fs from 'fs'

async function test() {
  await wasmBridge.init()

  const html = fs.readFileSync('./test_multilevel.html', 'utf-8')
  const nodes = await wasmBridge.parseHtml(html)

  console.log('Total nodes:', nodes.length)
  console.log('\nNode hierarchy:')

  // Build hierarchy map
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  function printNode(node, indent = 0) {
    const prefix = '  '.repeat(indent)
    const type = node.url ? '🔖' : '📁'
    console.log(`${prefix}${type} ${node.title} (id: ${node.id}, parent: ${node.parentId})`)

    // Find children
    const children = nodes.filter(n => n.parentId === node.id)
    children.forEach(child => printNode(child, indent + 1))
  }

  // Print from root
  const root = nodes.find(n => n.id === 'root')
  if (root) {
    printNode(root)
  }
}

test().catch(console.error)
