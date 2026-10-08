import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { TreeBranch, TreeLeaf, TreeNode } from './model'
import { deleteNotebook, loadNotebook } from './storage'

vi.mock('./TreeGraph', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ tree, onSelectLeaf, onToggleBranch }: {
      tree: TreeBranch
      onSelectLeaf: (id: string) => void
      onToggleBranch: (id: string) => void
    }) => {
      function renderNode(node: TreeNode) {
        if (node.type === 'leaf') {
          return createElement('button', { key: node.id, onClick: () => onSelectLeaf(node.id) }, node.name)
        }
        return createElement('section', { key: node.id },
          createElement('button', { onClick: () => onToggleBranch(node.id) }, node.name),
          ...node.children.map(renderNode),
        )
      }
      return createElement('div', { 'data-testid': 'tree-graph-double' }, renderNode(tree))
    },
  }
})

function findLeaf(branch: TreeBranch, name: string): TreeLeaf | undefined {
  for (const child of branch.children) {
    if (child.type === 'leaf' && child.name === name) return child
    if (child.type === 'branch') {
      const found = findLeaf(child, name)
      if (found) return found
    }
  }
  return undefined
}

describe('notebook user flows', () => {
  beforeEach(async () => deleteNotebook())
  afterEach(async () => deleteNotebook())

  it('opens a note drawer with breadcrumbs above the note and closes it back to the graph', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'The Drowned Coast' }))

    const breadcrumbs = screen.getByRole('navigation', { name: 'Sciezka notatki' })
    const noteHeading = screen.getByRole('heading', { name: 'The Drowned Coast' })
    expect(breadcrumbs.compareDocumentPosition(noteHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Zamknij notatke' }))
    expect(screen.queryByRole('navigation', { name: 'Sciezka notatki' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Mapa notatek' })).toBeTruthy()
  })

  it('creates a note, edits its text and restores it after remount', async () => {
    const user = userEvent.setup()
    const firstRender = render(<App />)
    await screen.findByRole('button', { name: 'The Drowned Coast' })

    await user.click(screen.getByRole('button', { name: 'Nowa notatka' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nazwa'), 'Testowa notatka')
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }))
    await user.click(await screen.findByRole('button', { name: 'Testowa notatka' }))
    await user.type(screen.getByRole('textbox', { name: 'Tresc bloku tekstowego' }), 'Tekst przetrwaly po odswiezeniu.')

    await waitFor(async () => {
      const notebook = await loadNotebook()
      expect(findLeaf(notebook!.root, 'Testowa notatka')?.note.blocks[0]).toMatchObject({
        type: 'text', text: 'Tekst przetrwaly po odswiezeniu.',
      })
    })

    firstRender.unmount()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Testowa notatka' }))
    expect((screen.getByRole('textbox', { name: 'Tresc bloku tekstowego' }) as HTMLTextAreaElement).value).toBe('Tekst przetrwaly po odswiezeniu.')
  })

  it('uploads an image and updates its caption', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const { container } = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'The Drowned Coast' }))
    const imageInput = container.querySelector('input[type="file"]')
    if (!(imageInput instanceof HTMLInputElement)) throw new Error('Image input was not rendered.')

    await user.upload(imageInput, new File(['image-bytes'], 'map.png', { type: 'image/png' }))
    expect(await screen.findByRole('img', { name: 'map.png' })).not.toBeNull()
    await user.type(screen.getByLabelText('Podpis'), 'Mapa zatopionej zatoki')
    expect(screen.getByText('Mapa zatopionej zatoki')).not.toBeNull()
  })

  it('reports a corrupted image instead of adding it to the note', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Invalid image.')))
    const { container } = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'The Drowned Coast' }))
    const imageInput = container.querySelector('input[type="file"]')
    if (!(imageInput instanceof HTMLInputElement)) throw new Error('Image input was not rendered.')

    await user.upload(imageInput, new File(['not-an-image'], 'broken.png', { type: 'image/png' }))

    expect(await screen.findByText('Nie udalo sie odczytac pliku. Wybierz poprawny obraz.')).not.toBeNull()
    expect(screen.queryByRole('img', { name: 'broken.png' })).toBeNull()
  })
})