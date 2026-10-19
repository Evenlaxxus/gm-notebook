import type { ImageBlock, TreeNode } from './model'

export function findNode(node: TreeNode, id: string): TreeNode | undefined {
  if (node.id === id) return node
  for (const child of node.children) {
    if (child.id === id) return child
    const found = findNode(child, id)
    if (found) return found
  }
  return undefined
}

export function findParentNode(node: TreeNode, id: string): TreeNode | undefined {
  for (const child of node.children) {
    if (child.id === id) return node
    const found = findParentNode(child, id)
    if (found) return found
  }
  return undefined
}

export function findNodePath(node: TreeNode, id: string, path: TreeNode[] = []): TreeNode[] | undefined {
  const nextPath = [...path, node]
  for (const child of node.children) {
    if (child.id === id) return nextPath
    const found = findNodePath(child, id, nextPath)
    if (found) return found
  }
  return undefined
}

export function findFirstNode(node: TreeNode): TreeNode | undefined {
  for (const child of node.children) {
    return findFirstNode(child) ?? child
  }
  return undefined
}

export function updateNode(node: TreeNode, id: string, update: (node: TreeNode) => TreeNode): TreeNode {
  if (node.id === id) return update(node)
  return {
    ...node,
    children: node.children.map((child) => {
      if (child.id === id) return update(child)
      return updateNode(child, id, update)
    }),
  }
}

export function removeNode(node: TreeNode, id: string): TreeNode {
  return {
    ...node,
    children: node.children
      .filter((child) => child.id !== id)
      .map((child) => removeNode(child, id)),
  }
}

export function moveNode(root: TreeNode, movingId: string, targetId: string): TreeNode | undefined {
  const moving = findNode(root, movingId)
  const target = findNode(root, targetId)
  if (!moving || moving.id === root.id || !target || movingId === targetId) return undefined
  if (findNode(moving, targetId)) return undefined

  const withoutMoving = removeNode(root, movingId)
  return updateNode(withoutMoving, targetId, (node) => ({ ...node, children: [...node.children, moving] }))
}

export function getImagesInNode(node: TreeNode): ImageBlock[] {
  return [
    ...node.note.blocks.filter((block): block is ImageBlock => block.type === 'image'),
    ...node.children.flatMap(getImagesInNode),
  ]
}