import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
import { moveNode } from '../../domain/tree'
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
  dropTarget: boolean
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
  onMoveNode: (movingId: string, targetId: string) => void
}

type DragPreview = { label: string; x: number; y: number }
type DragGesture = { id: string; pointerId: number; startX: number; startY: number; moved: boolean }
type BeginDrag = (id: string, label: string, event: ReactPointerEvent<HTMLDivElement>) => void

const BeginDragContext = createContext<BeginDrag>(() => {})

function NotebookNode({ id, data }: NodeProps<GraphNode>) {
  const beginDrag = useContext(BeginDragContext)
  return (
    <div
      className={`tree-graph__node nopan${data.active ? ' tree-graph__node--active' : ''}${data.dropTarget ? ' tree-graph__node--drop-target' : ''}`}
      onPointerDown={(event) => beginDrag(id, data.label, event)}
    >
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
  dropTargetId: string | null,
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
        dropTarget: node.id === dropTargetId,
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

function TreeGraph({ tree, selectedId, collapsedIds, onSelectNode, onToggleNode, onAddChild, onRename, onRemove, onMoveNode }: TreeGraphProps) {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const dragPreviewRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<DragGesture | null>(null)
  const dropTargetRef = useRef<string | null>(null)
  const draggedRef = useRef(false)

  const beginDrag = useCallback((id: string, label: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || id === tree.id) return
    event.stopPropagation()
    gestureRef.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false }
    dropTargetRef.current = null
    draggedRef.current = false
    setDropTargetId(null)
    setDragPreview({ label, x: event.clientX, y: event.clientY })
  }, [tree.id])

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 4) {
        gesture.moved = true
        draggedRef.current = true
      }
      if (dragPreviewRef.current) {
        dragPreviewRef.current.style.left = `${event.clientX}px`
        dragPreviewRef.current.style.top = `${event.clientY}px`
      }

      if (!gesture.moved) return
      const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.react-flow__node')
      const candidateId = targetElement?.dataset.id
      const nextTargetId = candidateId && candidateId !== gesture.id && moveNode(tree, gesture.id, candidateId)
        ? candidateId
        : null
      if (nextTargetId !== dropTargetRef.current) {
        dropTargetRef.current = nextTargetId
        setDropTargetId(nextTargetId)
      }
    }

    function finishGesture(event: PointerEvent, cancelled: boolean) {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      if (!cancelled && gesture.moved && dropTargetRef.current) {
        event.preventDefault()
        onMoveNode(gesture.id, dropTargetRef.current)
      }
      gestureRef.current = null
      dropTargetRef.current = null
      setDropTargetId(null)
      setDragPreview(null)
      window.setTimeout(() => { draggedRef.current = false }, 0)
    }

    const handlePointerUp = (event: PointerEvent) => finishGesture(event, false)
    const handlePointerCancel = (event: PointerEvent) => finishGesture(event, true)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [onMoveNode, tree])

  const graph = useMemo(
    () => layoutTree(tree, selectedId, collapsedIds, onSelectNode, onToggleNode, onAddChild, onRename, onRemove, dropTargetId),
    [tree, selectedId, collapsedIds, onSelectNode, onToggleNode, onAddChild, onRename, onRemove, dropTargetId],
  )

  const handleClickCapture = useCallback((event: React.MouseEvent) => {
    if (!draggedRef.current) return
    draggedRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  return (
    <div className="tree-graph__interaction-layer" onClickCapture={handleClickCapture}>
      <BeginDragContext.Provider value={beginDrag}>
        <ReactFlow
          className="tree-graph"
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          noPanClassName="nopan"
          fitView
          fitViewOptions={{ padding: 0.28, minZoom: 0.35, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={1.5}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="var(--color-graph-dot)" gap={22} size={1} />
          <Controls showInteractive={false} />
          {dragPreview && <div
            ref={dragPreviewRef}
            className="tree-graph__drag-preview tree-graph__node"
            style={{ left: dragPreview.x, top: dragPreview.y }}
            aria-hidden="true"
          >
            <span className="tree-graph__node-icon">▤</span>
            <span className="tree-graph__node-label">{dragPreview.label}</span>
          </div>}
        </ReactFlow>
      </BeginDragContext.Provider>
    </div>
  )
}

function hasSameTreeStructure(first: TreeNode, second: TreeNode): boolean {
  return first.id === second.id
    && first.name === second.name
    && first.children.length === second.children.length
    && first.children.every((child, index) => hasSameTreeStructure(child, second.children[index]))
}

function areTreeGraphPropsEqual(previous: TreeGraphProps, next: TreeGraphProps): boolean {
  return previous.selectedId === next.selectedId
    && previous.collapsedIds === next.collapsedIds
    && previous.onSelectNode === next.onSelectNode
    && previous.onToggleNode === next.onToggleNode
    && previous.onAddChild === next.onAddChild
    && previous.onRename === next.onRename
    && previous.onRemove === next.onRemove
    && previous.onMoveNode === next.onMoveNode
    && hasSameTreeStructure(previous.tree, next.tree)
}

export default memo(TreeGraph, areTreeGraphPropsEqual)