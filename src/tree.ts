import type { ImageBlock, TreeBranch, TreeLeaf, TreeNode } from './model'

export function findNode(branch: TreeBranch, id: string): TreeNode | undefined {
  if (branch.id === id) return branch
  for (const child of branch.children) {
    if (child.id === id) return child
    if (child.type === 'branch') {
      const found = findNode(child, id)
      if (found) return found
    }
  }
  return undefined
}

export function findParentBranch(branch: TreeBranch, id: string): TreeBranch | undefined {
  for (const child of branch.children) {
    if (child.id === id) return branch
    if (child.type === 'branch') {
      const found = findParentBranch(child, id)
      if (found) return found
    }
  }
  return undefined
}

export function findFirstLeaf(branch: TreeBranch): TreeLeaf | undefined {
  for (const child of branch.children) {
    if (child.type === 'leaf') return child
    const found = findFirstLeaf(child)
    if (found) return found
  }
  return undefined
}

export function updateNode(branch: TreeBranch, id: string, update: (node: TreeNode) => TreeNode): TreeBranch {
  return {
    ...branch,
    children: branch.children.map((child) => {
      if (child.id === id) return update(child)
      return child.type === 'branch' ? updateNode(child, id, update) : child
    }),
  }
}

export function removeNode(branch: TreeBranch, id: string): TreeBranch {
  return {
    ...branch,
    children: branch.children
      .filter((child) => child.id !== id)
      .map((child) => child.type === 'branch' ? removeNode(child, id) : child),
  }
}

export function moveNode(root: TreeBranch, movingId: string, targetId: string): TreeBranch | undefined {
  const moving = findNode(root, movingId)
  const target = findNode(root, targetId)
  if (!moving || moving.id === root.id || target?.type !== 'branch' || movingId === targetId) return undefined
  if (moving.type === 'branch' && findNode(moving, targetId)) return undefined

  const withoutMoving = removeNode(root, movingId)
  if (targetId === root.id) return { ...withoutMoving, children: [...withoutMoving.children, moving] }
  return updateNode(withoutMoving, targetId, (node) => node.type === 'branch'
    ? { ...node, children: [...node.children, moving] }
    : node)
}

export function getImagesInNode(node: TreeNode): ImageBlock[] {
  if (node.type === 'leaf') return node.note.blocks.filter((block): block is ImageBlock => block.type === 'image')
  return node.children.flatMap(getImagesInNode)
}