export interface Notebook {
  id: string
  root: TreeBranch
}

export interface TreeBranch {
  id: string
  type: 'branch'
  name: string
  children: TreeNode[]
}

export interface TreeLeaf {
  id: string
  type: 'leaf'
  name: string
  note: Note
}

export type TreeNode = TreeBranch | TreeLeaf

export interface Note {
  id: string
  blocks: NoteBlock[]
  updatedAt: string
}

export interface TextBlock {
  id: string
  type: 'text'
  text: string
  x?: number
  y?: number
  width?: number
}

export interface ImageBlock {
  id: string
  type: 'image'
  blob: Blob
  x?: number
  y?: number
  altText: string
  caption: string
  width: number
  alignment: 'left' | 'center' | 'right'
}

export type NoteBlock = TextBlock | ImageBlock