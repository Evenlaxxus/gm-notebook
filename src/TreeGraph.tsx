import { useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import type { TreeBranch, TreeNode } from './model'
import './TreeGraph.css'

type GraphNodeData = {
  label: string
  kind: 'branch' | 'leaf'
  childCount: number
  collapsed: boolean
  active: boolean
  isRoot: boolean
  activate: () => void
  addNote: () => void
  rename: () => void
  remove: () => void
}

type GraphNode = Node<GraphNodeData, 'notebookNode'>

type TreeGraphProps = {
  tree: TreeBranch
  selectedId: string
  collapsedIds: string[]
  onSelectLeaf: (id: string) => void
  onToggleBranch: (id: string) => void
  onAddNote: (branch: TreeBranch) => void
  onRename: (node: TreeNode) => void
  onRemove: (node: TreeNode) => void
}

function NotebookNode({ data }: NodeProps<GraphNode>) {
  return (
    <div className={`graph-node graph-node-${data.kind}${data.active ? ' is-active' : ''}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="graph-node-content">
        <button className="graph-node-button" type="button" onClick={data.activate} aria-expanded={data.kind === 'branch' ? !data.collapsed : undefined}>
          <span className="graph-node-icon" aria-hidden="true">{data.kind === 'branch' ? '▰' : '▤'}</span>
          <span className="graph-node-label">{data.label}</span>
          {data.kind === 'branch'
            ? <span className="graph-node-count">{data.collapsed ? '+' : '-'} {data.childCount}</span>
            : <span className="graph-node-open" aria-hidden="true">↗</span>}
        </button>
        <div className="graph-node-actions">
          {data.kind === 'branch' && <button type="button" title="Dodaj notatke" aria-label={`Dodaj notatke w ${data.label}`} onClick={data.addNote}>+</button>}
          {!data.isRoot && <>
            <button type="button" title="Zmien nazwe" aria-label={`Zmien nazwe ${data.label}`} onClick={data.rename}>...</button>
            <button type="button" title="Usun" aria-label={`Usun ${data.label}`} onClick={data.remove}>x</button>
          </>}
        </div>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}

const nodeTypes: NodeTypes = { notebookNode: NotebookNode }

function layoutTree(
  root: TreeBranch,
  selectedId: string,
  collapsedIds: string[],
  onSelectLeaf: (id: string) => void,
  onToggleBranch: (id: string) => void,
  onAddNote: (branch: TreeBranch) => void,
  onRename: (node: TreeNode) => void,
  onRemove: (node: TreeNode) => void,
): { nodes: GraphNode[]; edges: Edge[] } {
  const nodes: GraphNode[] = []
  const edges: Edge[] = []
  let nextY = 24

  function visit(node: TreeNode, depth: number, parentId?: string): number {
    const collapsed = node.type === 'branch' && collapsedIds.includes(node.id)
    const childY = node.type === 'branch' && !collapsed
      ? node.children.map((child) => visit(child, depth + 1, node.id))
      : []
    const y = childY.length
      ? (childY[0] + childY[childY.length - 1]) / 2
      : nextY

    if (!childY.length) nextY += node.type === 'branch' ? 112 : 132

    nodes.push({
      id: node.id,
      type: 'notebookNode',
      position: { x: depth * 260 + 28, y },
      data: {
        label: node.name,
        kind: node.type,
        childCount: node.type === 'branch' ? node.children.length : 0,
        collapsed,
        active: node.type === 'leaf' && node.id === selectedId,
        isRoot: node.id === root.id,
        activate: () => node.type === 'branch' ? onToggleBranch(node.id) : onSelectLeaf(node.id),
        addNote: () => { if (node.type === 'branch') onAddNote(node) },
        rename: () => onRename(node),
        remove: () => onRemove(node),
      },
    })

    if (parentId) {
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'smoothstep',
        style: { stroke: '#aebdb4', strokeWidth: 1.5 },
      })
    }
    return y
  }

  visit(root, 0)
  return { nodes, edges }
}

export default function TreeGraph({ tree, selectedId, collapsedIds, onSelectLeaf, onToggleBranch, onAddNote, onRename, onRemove }: TreeGraphProps) {
  const graph = useMemo(
    () => layoutTree(tree, selectedId, collapsedIds, onSelectLeaf, onToggleBranch, onAddNote, onRename, onRemove),
    [tree, selectedId, collapsedIds, onSelectLeaf, onToggleBranch, onAddNote, onRename, onRemove],
  )

  return (
    <ReactFlow
      nodes={graph.nodes}
      edges={graph.edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.28, minZoom: 0.35, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={1.5}
      proOptions={{ hideAttribution: false }}
    >
      <Background color="#d4ded7" gap={22} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}