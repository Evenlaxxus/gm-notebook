import type { Notebook, Note, NoteBlock, TreeNode } from '../domain/model'
import { createId } from '../domain/ids'

const DATABASE_NAME = 'gm-notebook'
const DATABASE_VERSION = 1
const STORE_NAME = 'workspace'
const NOTEBOOK_KEY = 'current'
const MAX_TREE_DEPTH = 50
const MAX_TREE_NODES = 2000
const MAX_NOTE_BLOCKS = 500
const MAX_TEXT_LENGTH = 100_000
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

let databasePromise: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB is unavailable.'))

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('Could not open notebook storage.'))
    request.onblocked = () => reject(new Error('Notebook storage upgrade is blocked.'))
  }).catch((error: unknown) => {
    databasePromise = undefined
    throw error
  })
  databasePromise = opening
  return opening
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction was aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Storage transaction failed.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Storage request failed.'))
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
}

function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 100
}

function isOptionalNumber(value: unknown, min: number, max: number): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max)
}

function isBlob(value: unknown): value is Blob {
  const tag = Object.prototype.toString.call(value)
  return typeof Blob !== 'undefined'
    && isRecord(value)
    && (tag === '[object Blob]' || tag === '[object File]')
    && typeof value.size === 'number'
    && typeof value.type === 'string'
    && typeof value.slice === 'function'
}

function isValidBlock(value: unknown, ids: Set<string>): value is NoteBlock {
  if (!isRecord(value) || !isValidId(value.id) || ids.has(value.id)) return false
  ids.add(value.id)
  if (!isOptionalNumber(value.x, 0, 100) || !isOptionalNumber(value.y, 0, 1_000_000)) return false

  if (value.type === 'text') {
    return typeof value.text === 'string'
      && value.text.length <= MAX_TEXT_LENGTH
      && isOptionalNumber(value.width, 1, 100)
  }

  return value.type === 'image'
    && isBlob(value.blob)
    && value.blob.size <= MAX_IMAGE_BYTES
    && value.blob.type.startsWith('image/')
    && typeof value.altText === 'string'
    && value.altText.length <= 500
    && typeof value.caption === 'string'
    && value.caption.length <= 500
    && typeof value.width === 'number'
    && Number.isFinite(value.width)
    && value.width >= 20
    && value.width <= 100
    && (value.alignment === 'left' || value.alignment === 'center' || value.alignment === 'right')
}

function isValidNote(value: unknown, ids: Set<string>): value is Note {
  if (!isRecord(value) || !isValidId(value.id) || ids.has(value.id)) return false
  ids.add(value.id)
  return typeof value.updatedAt === 'string'
    && Number.isFinite(Date.parse(value.updatedAt))
    && Array.isArray(value.blocks)
    && value.blocks.length <= MAX_NOTE_BLOCKS
    && value.blocks.every((block) => isValidBlock(block, ids))
}

function isValidNode(value: unknown, ids: Set<string>, depth: number, count: { value: number }): value is TreeNode {
  if (!isRecord(value) || !isValidId(value.id) || ids.has(value.id) || !isValidName(value.name)) return false
  if (depth > MAX_TREE_DEPTH || count.value >= MAX_TREE_NODES) return false
  ids.add(value.id)
  count.value += 1

  if (value.type === 'branch' && value.note === undefined) {
    return Array.isArray(value.children)
      && value.children.every((child) => isValidNode(child, ids, depth + 1, count))
  }
  if (value.type === 'leaf' && value.children === undefined) {
    return isValidNote(value.note, ids)
  }
  return isValidNote(value.note, ids)
    && Array.isArray(value.children)
    && value.children.every((child) => isValidNode(child, ids, depth + 1, count))
}

function isValidNotebook(value: unknown): value is Notebook {
  if (!isRecord(value) || !isValidId(value.id) || !isRecord(value.root)) return false
  const ids = new Set<string>()
  return isValidNode(value.root, ids, 0, { value: 0 })
}

function collectIds(value: unknown, ids: Set<string>) {
  if (!isRecord(value)) return
  ids.add(value.id as string)
  if (isRecord(value.note)) {
    ids.add(value.note.id as string)
    if (Array.isArray(value.note.blocks)) {
      for (const block of value.note.blocks) {
        if (isRecord(block)) ids.add(block.id as string)
      }
    }
  }
  if (Array.isArray(value.children)) {
    for (const child of value.children) {
      if (isRecord(child)) collectIds(child, ids)
    }
  }
}

function normalizeNode(value: unknown, ids: Set<string>): TreeNode {
  if (!isRecord(value)) throw new Error('Stored notebook data is invalid.')
  let note = value.note as Note | undefined
  if (!note) {
    let noteId = createId()
    while (ids.has(noteId)) noteId = createId()
    ids.add(noteId)
    note = { id: noteId, updatedAt: new Date().toISOString(), blocks: [] }
  }
  const children = (value.children as unknown[] | undefined) ?? []
  return {
    id: value.id as string,
    name: value.name as string,
    note,
    children: children.map((child) => normalizeNode(child, ids)),
  }
}

export async function loadNotebook(): Promise<Notebook | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const completion = transactionComplete(transaction)
  const request = requestResult<unknown>(transaction.objectStore(STORE_NAME).get(NOTEBOOK_KEY))
  const [value] = await Promise.all([request, completion])
  if (value === undefined) return undefined
  if (!isValidNotebook(value)) throw new Error('Stored notebook data is invalid.')
  const usedIds = new Set<string>()
  collectIds(value.root, usedIds)
  return { id: value.id, root: normalizeNode(value.root, usedIds) }
}

export async function saveNotebook(notebook: Notebook): Promise<void> {
  if (!isValidNotebook(notebook)) throw new Error('Notebook data is invalid.')
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const completion = transactionComplete(transaction)
  transaction.objectStore(STORE_NAME).put(notebook, NOTEBOOK_KEY)
  await completion
}

export async function deleteNotebook(): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const completion = transactionComplete(transaction)
  transaction.objectStore(STORE_NAME).delete(NOTEBOOK_KEY)
  await completion
}