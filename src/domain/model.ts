export interface Notebook {
  id: string
  root: TreeNode
}

export interface TreeNode {
  id: string
  name: string
  note: Note
  children: TreeNode[]
}

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
  height?: number
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