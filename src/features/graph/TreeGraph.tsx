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
import type { TreeNode } from '../../domain/model'
import './TreeGraph.scss'

type GraphNodeData = {
  label: string
  childCount: number
  collapsed: boolean
  toggle: () => void
  active: boolean
  isRoot: boolean
  activate: () => void
  addNote: () => void
  rename: () => void
  remove: () => void
}

type GraphNode = Node<GraphNodeData, 'notebookNode'>

type TreeGraphProps = {
  tree: TreeNode
  selectedId: string
  collapsedIds: string[]
  onSelectNode: (id: string) => void
  onToggleNode: (id: string) => void
  onAddChild: (node: TreeNode) => void
  onRename: (node: TreeNode) => void
  onRemove: (node: TreeNode) => void
}

function NotebookNode({ data }: NodeProps<GraphNode>) {
  return (
    <div className={`tree-graph__node${data.active ? ' tree-graph__node--active' : ''}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="tree-graph__node-content">
        <button className="tree-graph__node-button" type="button" onClick={data.activate}>
          <span className="tree-graph__node-icon" aria-hidden="true">▤</span>
          <span className="tree-graph__node-label">{data.label}</span>
          <span className="tree-graph__node-open" aria-hidden="true">↗</span>
        </button>
        <div className="tree-graph__node-actions">
          <button type="button" title="Dodaj element" aria-label={`Dodaj element w ${data.label}`} onClick={data.addNote}>+</button>
          {!data.isRoot && <>
            <button type="button" title="Zmien nazwe" aria-label={`Zmien nazwe ${data.label}`} onClick={data.rename}>...</button>
            <button type="button" title="Usun" aria-label={`Usun ${data.label}`} onClick={data.remove}>x</button>
          </>}
        </div>
        {data.childCount > 0 && <button
          className="tree-graph__node-toggle"
          type="button"
          title={data.collapsed ? 'Rozwin dzieci' : 'Zwin dzieci'}
          aria-label={`${data.collapsed ? 'Rozwin' : 'Zwin'} dzieci ${data.label}`}
          aria-expanded={!data.collapsed}
          onClick={data.toggle}
        >{data.collapsed ? '+' : '-'} {data.childCount}</button>}
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}

const nodeTypes: NodeTypes = { notebookNode: NotebookNode }

function layoutTree(
  root: TreeNode,
  selectedId: string,
  collapsedIds: string[],
  onSelectNode: (id: string) => void,
  onToggleNode: (id: string) => void,
  onAddChild: (node: TreeNode) => void,
  onRename: (node: TreeNode) => void,
  onRemove: (node: TreeNode) => void,
): { nodes: GraphNode[]; edges: Edge[] } {
  const nodes: GraphNode[] = []
  const edges: Edge[] = []
  let nextY = 24

  function visit(node: TreeNode, depth: number, parentId?: string): number {
    const collapsed = collapsedIds.includes(node.id)
    const childY = !collapsed ? node.children.map((child) => visit(child, depth + 1, node.id)) : []
    const y = childY.length
      ? (childY[0] + childY[childY.length - 1]) / 2
      : nextY

    if (!childY.length) nextY += 132

    nodes.push({
      id: node.id,
      type: 'notebookNode',
      position: { x: depth * 260 + 28, y },
      data: {
        label: node.name,
        childCount: node.children.length,
        collapsed,
        active: node.id === selectedId,
        isRoot: node.id === root.id,
        activate: () => onSelectNode(node.id),
        toggle: () => onToggleNode(node.id),
        addNote: () => onAddChild(node),
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
        style: { stroke: 'var(--color-graph-edge)', strokeWidth: 1.5 },
      })
    }
    return y
  }

  visit(root, 0)
  return { nodes, edges }
}

export default function TreeGraph({ tree, selectedId, collapsedIds, onSelectNode, onToggleNode, onAddChild, onRename, onRemove }: TreeGraphProps) {
  const graph = useMemo(
    () => layoutTree(tree, selectedId, collapsedIds, onSelectNode, onToggleNode, onAddChild, onRename, onRemove),
    [tree, selectedId, collapsedIds, onSelectNode, onToggleNode, onAddChild, onRename, onRemove],
  )

  return (
    <ReactFlow
      className="tree-graph"
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
      <Background color="var(--color-graph-dot)" gap={22} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}