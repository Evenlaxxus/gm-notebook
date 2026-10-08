import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Notebook } from '../domain/model'
import { deleteNotebook, loadNotebook, saveNotebook } from './indexedDb'

function createNotebook(): Notebook {
  return {
    id: 'test-notebook',
    root: {
      id: 'root',
      type: 'branch',
      name: 'Notatki',
      children: [{
        id: 'leaf',
        type: 'leaf',
        name: 'Mapa zatoki',
        note: {
          id: 'note',
          updatedAt: '2026-01-01T00:00:00.000Z',
          blocks: [
            { id: 'text', type: 'text', text: 'Notatka testowa', x: 8, y: 20, width: 80 },
            {
              id: 'image', type: 'image',
              blob: new NodeBlob(['map-bytes'], { type: 'image/png' }),
              x: 25, y: 200, altText: 'Mapa', caption: 'Zatoka', width: 50, alignment: 'center',
            },
          ],
        },
      }],
    },
  }
}

describe('notebook IndexedDB storage', () => {
  beforeEach(async () => deleteNotebook())

  it('round-trips the tree, note blocks and image Blob', async () => {
    const notebook = createNotebook()
    await saveNotebook(notebook)

    const restored = await loadNotebook()
    expect(restored).toEqual(notebook)
    const leaf = restored?.root.children[0]
    expect(leaf?.type).toBe('leaf')
    if (leaf?.type !== 'leaf') throw new Error('Expected a note leaf.')
    const image = leaf.note.blocks[1]
    expect(image?.type).toBe('image')
    if (image?.type !== 'image') throw new Error('Expected an image block.')
    expect(image.blob).toBeInstanceOf(NodeBlob)
    expect(await image.blob.text()).toBe('map-bytes')
  })

  it('rejects invalid data before it is stored', async () => {
    const notebook = createNotebook()
    const invalid = {
      ...notebook,
      root: { ...notebook.root, children: [{ ...notebook.root.children[0], name: '   ' }] },
    } as Notebook

    await expect(saveNotebook(invalid)).rejects.toThrow('Notebook data is invalid.')
    await expect(loadNotebook()).resolves.toBeUndefined()
  })

  it('removes the stored notebook only when explicitly requested', async () => {
    await saveNotebook(createNotebook())
    await expect(loadNotebook()).resolves.toBeDefined()

    await deleteNotebook()

    await expect(loadNotebook()).resolves.toBeUndefined()
  })
})