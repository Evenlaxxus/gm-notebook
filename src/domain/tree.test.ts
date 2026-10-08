import { describe, expect, it } from 'vitest'
import type { TreeBranch, TreeLeaf } from './model'
import { findNode, findParentBranch, moveNode, removeNode } from './tree'

function leaf(id: string, name = id): TreeLeaf {
  return {
    id,
    type: 'leaf',
    name,
    note: { id: `note-${id}`, updatedAt: '2026-01-01T00:00:00.000Z', blocks: [] },
  }
}

function branch(id: string, children: TreeBranch['children'] = []): TreeBranch {
  return { id, type: 'branch', name: id, children }
}

function fixture(): TreeBranch {
  return branch('root', [
    branch('source', [branch('nested', [leaf('note-a')])]),
    branch('destination'),
  ])
}

describe('tree operations', () => {
  it('moves a note into another branch without mutating the original tree', () => {
    const original = fixture()
    const moved = moveNode(original, 'note-a', 'destination')

    expect(moved && findNode(moved, 'note-a')?.id).toBe('note-a')
    expect(findParentBranch(moved!, 'note-a')?.id).toBe('destination')
    expect(findParentBranch(original, 'note-a')?.id).toBe('nested')
  })

  it('rejects moving a branch into itself or its descendants', () => {
    const tree = fixture()

    expect(moveNode(tree, 'source', 'source')).toBeUndefined()
    expect(moveNode(tree, 'source', 'nested')).toBeUndefined()
  })

  it('rejects moving a leaf into another leaf', () => {
    const tree = branch('root', [leaf('one'), leaf('two')])

    expect(moveNode(tree, 'one', 'two')).toBeUndefined()
  })

  it('removes a branch and its descendants while preserving siblings', () => {
    const original = fixture()
    const next = removeNode(original, 'source')

    expect(findNode(next, 'source')).toBeUndefined()
    expect(findNode(next, 'note-a')).toBeUndefined()
    expect(findNode(next, 'destination')).toBeDefined()
    expect(findNode(original, 'note-a')).toBeDefined()
  })
})