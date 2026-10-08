import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import '@xyflow/react/dist/style.css'
import type { ImageBlock, Note, NoteBlock, TextBlock, TreeBranch, TreeLeaf } from '../domain/model'
import { createId as makeId } from '../domain/ids'
import { createNote as makeNote, initialTree } from '../domain/initialTree'
import { findBranchPath, findFirstLeaf, findNode, findParentBranch, getImagesInNode, removeNode, updateNode } from '../domain/tree'
import { deleteNotebook, loadNotebook, saveNotebook } from '../storage/indexedDb'
import NoteEditor from '../features/editor/NoteEditor'
import TreeGraph from '../features/graph/TreeGraph'
import './App.css'

type DialogState = {
  kind: 'branch' | 'note' | 'rename' | 'delete'
  parentId?: string
  nodeId?: string
  value: string
}

function App() {
  const [tree, setTree] = useState(initialTree)
  const [selectedId, setSelectedId] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<string[]>([])
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [dialogError, setDialogError] = useState('')
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [editorMessage, setEditorMessage] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [storageStatus, setStorageStatus] = useState<'loading' | 'saving' | 'saved' | 'error' | 'load-error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saveRetry, setSaveRetry] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const saveVersionRef = useRef(0)
  const selectedNode = findNode(tree, selectedId)
  const selectedLeaf = selectedNode?.type === 'leaf' ? selectedNode : undefined
  const parentBranch = selectedLeaf ? findParentBranch(tree, selectedLeaf.id) : undefined
  const breadcrumbBranches = selectedLeaf
    ? (findBranchPath(tree, selectedLeaf.id) ?? []).filter((branch) => branch.id !== tree.id)
    : []

  useEffect(() => {
    let cancelled = false
    loadNotebook().then((notebook) => {
      if (cancelled) return
      if (notebook) {
        setTree(notebook.root)
        setSelectedId('')
        setImageUrls(Object.fromEntries(getImagesInNode(notebook.root).map((block) => [block.id, URL.createObjectURL(block.blob)])))
      }
      setStorageStatus('saved')
      setIsHydrated(true)
    }).catch(() => {
      if (cancelled) return
      setLoadError('Nie udalo sie odczytac lokalnych danych. Nie zostaly nadpisane.')
      setStorageStatus('load-error')
    })
    return () => { cancelled = true }
  }, [loadAttempt])

  useEffect(() => {
    if (!isHydrated) return
    const saveVersion = ++saveVersionRef.current
    const timeout = window.setTimeout(() => {
      setStorageStatus('saving')
      void saveNotebook({ id: 'main', root: tree }).then(() => {
        if (saveVersionRef.current === saveVersion) setStorageStatus('saved')
      }).catch(() => {
        if (saveVersionRef.current === saveVersion) setStorageStatus('error')
      })
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [tree, isHydrated, saveRetry])

  function openDialog(nextDialog: DialogState) {
    setDialogError('')
    setDialog(nextDialog)
  }

  function retryStorageLoad() {
    setLoadError('')
    setStorageStatus('loading')
    setLoadAttempt((attempt) => attempt + 1)
  }

  async function resetStorageAfterConfirmation() {
    const confirmed = window.confirm('Usunac uszkodzony zapis notesu i utworzyc nowy? Tej operacji nie mozna cofnac.')
    if (!confirmed) return
    setStorageStatus('loading')
    setLoadError('')
    try {
      await deleteNotebook()
      setTree(initialTree)
      setSelectedId(findFirstLeaf(initialTree)?.id ?? '')
      setImageUrls({})
      setCollapsedIds([])
      setIsHydrated(true)
    } catch {
      setLoadError('Nie udalo sie wyczyscic lokalnego zapisu.')
      setStorageStatus('load-error')
    }
  }

  function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog) return
    if (dialog.kind === 'delete' && dialog.nodeId) {
      const removedNode = findNode(tree, dialog.nodeId)
      const removedImageIds = removedNode ? getImagesInNode(removedNode).map((block) => block.id) : []
      removedImageIds.forEach((id) => {
        const url = imageUrls[id]
        if (url) URL.revokeObjectURL(url)
      })
      setImageUrls((current) => {
        const next = { ...current }
        removedImageIds.forEach((id) => delete next[id])
        return next
      })
      const nextTree = removeNode(tree, dialog.nodeId)
      setTree(nextTree)
      if (selectedId === dialog.nodeId || !findNode(nextTree, selectedId)) {
        setSelectedId(findFirstLeaf(nextTree)?.id ?? '')
      }
      setCollapsedIds((ids) => ids.filter((id) => id !== dialog.nodeId))
      setDialog(null)
      return
    }

    const name = dialog.value.trim()
    if (!name) {
      setDialogError('Nazwa nie moze byc pusta.')
      return
    }
    if (name.length > 100) {
      setDialogError('Nazwa moze miec maksymalnie 100 znakow.')
      return
    }
    const parentId = dialog.kind === 'note'
      ? dialog.parentId ?? tree.id
      : dialog.kind === 'rename'
        ? findParentBranch(tree, dialog.nodeId ?? '')?.id ?? tree.id
        : tree.id
    const parentNode = findNode(tree, parentId)
    if (parentNode?.type !== 'branch') {
      setDialogError('Wybrana galaz juz nie istnieje.')
      return
    }
    if (parentNode.children.some((node) => node.id !== dialog.nodeId && node.name.toLowerCase() === name.toLowerCase())) {
      setDialogError('Element o tej nazwie juz istnieje w tej galezi.')
      return
    }
    if (dialog.kind === 'branch') {
      const branch: TreeBranch = { id: makeId(), type: 'branch', name, children: [] }
      setTree((current) => ({ ...current, children: [...current.children, branch] }))
      setCollapsedIds((ids) => ids.filter((id) => id !== branch.id))
    } else if (dialog.kind === 'note') {
      const leaf: TreeLeaf = { id: makeId(), type: 'leaf', name, note: makeNote('') }
      if (parentId === tree.id) {
        setTree((current) => ({ ...current, children: [...current.children, leaf] }))
      } else {
        setTree((current) => updateNode(current, parentId, (node) => node.type === 'branch'
          ? { ...node, children: [...node.children, leaf] }
          : node))
        setCollapsedIds((ids) => ids.filter((id) => id !== parentId))
      }
      setSelectedId(leaf.id)
    } else if (dialog.kind === 'rename' && dialog.nodeId) {
      setTree((current) => updateNode(current, dialog.nodeId!, (node) => ({ ...node, name })))
    }
    setDialog(null)
  }

  function updateSelectedNote(update: (note: Note) => Note) {
    if (!selectedLeaf) return
    const leafId = selectedLeaf.id
    setTree((current) => updateNode(current, leafId, (node) => node.type === 'leaf'
      ? { ...node, note: { ...update(node.note), updatedAt: new Date().toISOString() } }
      : node))
  }

  function updateBlock(blockId: string, update: (block: NoteBlock) => NoteBlock) {
    updateSelectedNote((note) => ({
      ...note,
      blocks: note.blocks.map((block) => block.id === blockId ? update(block) : block),
    }))
  }

  function addTextBlock() {
    if (!selectedLeaf) return
    const block: TextBlock = {
      id: makeId(), type: 'text', text: '', x: 8,
      y: Math.max(20, ...selectedLeaf.note.blocks.map((item) => (item.y ?? 20) + 170)),
      width: 82,
    }
    updateSelectedNote((note) => ({ ...note, blocks: [...note.blocks, block] }))
    setEditorMessage('Dodano pole tekstowe.')
  }

  async function addImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !selectedLeaf) return
    const targetLeafId = selectedLeaf.id
    if (!file.type.startsWith('image/')) {
      setEditorMessage('Nieobslugiwany format. Wybierz plik obrazu.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setEditorMessage('Obraz nie moze przekraczac 20 MB.')
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      bitmap.close()
    } catch {
      setEditorMessage('Nie udalo sie odczytac pliku. Wybierz poprawny obraz.')
      return
    }
    if (selectedId !== targetLeafId) {
      setEditorMessage('Notatka zmienila sie podczas sprawdzania obrazu. Sprobuj ponownie.')
      return
    }
    const targetLeaf = findNode(tree, targetLeafId)
    if (targetLeaf?.type !== 'leaf') return
    const imageWidth = 48
    const block: ImageBlock = {
      id: makeId(), type: 'image', blob: file,
      x: (100 - imageWidth) / 2,
      y: Math.max(20, ...targetLeaf.note.blocks.map((item) => (item.y ?? 20) + 190)),
      altText: file.name, caption: '', width: imageWidth, alignment: 'center',
    }
    const imageUrl = URL.createObjectURL(file)
    setImageUrls((current) => ({ ...current, [block.id]: imageUrl }))
    updateSelectedNote((note) => ({ ...note, blocks: [...note.blocks, block] }))
    setEditorMessage('Dodano obraz.')
  }

  function moveCanvasBlock(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!selectedLeaf) return
    const blockId = event.dataTransfer.getData('application/x-note-block')
    const block = selectedLeaf.note.blocks.find((item) => item.id === blockId)
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!block || bounds.width === 0) return
    const nextX = Math.max(0, Math.min(100 - (block.width ?? 82), ((event.clientX - bounds.left) / bounds.width) * 100))
    const nextY = Math.max(0, event.clientY - bounds.top - 18)
    updateBlock(blockId, (current) => ({ ...current, x: nextX, y: nextY }))
  }

  function nudgeBlock(blockId: string, horizontal: number, vertical: number) {
    updateBlock(blockId, (block) => ({
      ...block,
      x: Math.max(0, Math.min(100 - (block.width ?? 82), (block.x ?? 8) + horizontal)),
      y: Math.max(0, (block.y ?? 20) + vertical),
    }))
  }

  function removeBlock(blockId: string) {
    const block = selectedLeaf?.note.blocks.find((item) => item.id === blockId)
    const imageUrl = block?.type === 'image' ? imageUrls[blockId] : undefined
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    if (block?.type === 'image') {
      setImageUrls((current) => {
        const next = { ...current }
        delete next[blockId]
        return next
      })
    }
    updateSelectedNote((note) => ({ ...note, blocks: note.blocks.filter((block) => block.id !== blockId) }))
    setEditorMessage('Usunieto element.')
  }

  function alignImage(block: ImageBlock, alignment: ImageBlock['alignment']) {
    const x = alignment === 'left'
      ? Math.min(8, 100 - block.width)
      : alignment === 'center'
        ? Math.max(0, (100 - block.width) / 2)
        : Math.max(0, 92 - block.width)
    updateBlock(block.id, (current) => current.type === 'image' ? { ...current, alignment, x } : current)
  }

  return (
    <div className="notebook-shell">
      <aside className="sidebar">
        <a className="brand" href="#main-content">
          <span className="brand-mark" aria-hidden="true">GM</span>
          <span className="brand-name">Game Master<span>Notebook</span></span>
        </a>
        <div className="sidebar-tools">
          <label className="search-box">
            <span aria-hidden="true">/</span>
            <input type="search" placeholder="Szukaj notatek" aria-label="Szukaj notatek" />
            <kbd>Ctrl K</kbd>
          </label>
          <button className="new-note-button" type="button" onClick={() => openDialog({ kind: 'note', parentId: parentBranch?.id, value: '' })}><span aria-hidden="true">+</span> Nowa notatka</button>
          <button className="new-branch-button" type="button" onClick={() => openDialog({ kind: 'branch', value: '' })}>+ Nowa galez</button>
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">R</span>
          <span className="profile-name">Rafal</span>
          <span className="profile-status">Lokalny notes</span>
        </div>
      </aside>
      <main className="workspace" id="main-content">
        <section className="graph-view">
          <header className="graph-header">
            <div className="graph-heading"><span>NOTATNIK KAMPANII</span><h1>Mapa notatek</h1></div>
            <div className="graph-status-actions">
              <span className={`save-status save-status-${storageStatus}`} aria-live="polite">
                <i aria-hidden="true" />
                {storageStatus === 'loading' || storageStatus === 'load-error' ? 'Wczytywanie...' : storageStatus === 'saving' ? 'Zapisywanie...' : storageStatus === 'error' ? 'Blad zapisu' : 'Zapisano lokalnie'}
              </span>
              {storageStatus === 'error' && <button className="retry-save-button" type="button" onClick={() => setSaveRetry((retry) => retry + 1)}>Ponow zapis</button>}
            </div>
          </header>
          <div className={`graph-stage${selectedLeaf ? ' has-note-drawer' : ''}`}>
            <div className="graph-canvas">
              <TreeGraph
                tree={tree}
                selectedId={selectedId}
                collapsedIds={collapsedIds}
                onSelectLeaf={setSelectedId}
                onToggleBranch={(id) => setCollapsedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
                onAddNote={(branch) => openDialog({ kind: 'note', parentId: branch.id, value: '' })}
                onRename={(node) => openDialog({ kind: 'rename', nodeId: node.id, value: node.name })}
                onRemove={(node) => openDialog({ kind: 'delete', nodeId: node.id, value: node.name })}
              />
            </div>
            <aside className={`note-drawer${selectedLeaf ? ' is-open' : ''}`} aria-hidden={!selectedLeaf}>
              {selectedLeaf && <>
                <header className="drawer-header">
                  <nav className="note-breadcrumbs" aria-label="Sciezka notatki">
                    {breadcrumbBranches.map((branch) => <span key={branch.id}>{branch.name}<i aria-hidden="true">/</i></span>)}
                    <strong>{selectedLeaf.name}</strong>
                  </nav>
                  <button className="drawer-close" type="button" aria-label="Zamknij notatke" onClick={() => setSelectedId('')}>x</button>
                </header>
                <div className="drawer-scroll">
                  <NoteEditor
                    title={selectedLeaf.name}
                    updatedAt={selectedLeaf.note.updatedAt}
                    blocks={selectedLeaf.note.blocks}
                    imageUrls={imageUrls}
                    editorMessage={editorMessage}
                    imageInputRef={imageInputRef}
                    onAddText={addTextBlock}
                    onAddImage={addImage}
                    onUpdateBlock={updateBlock}
                    onMoveBlock={moveCanvasBlock}
                    onNudgeBlock={nudgeBlock}
                    onRemoveBlock={removeBlock}
                    onAlignImage={alignImage}
                  />
                </div>
              </>}
            </aside>
          </div>
        </section>
      </main>
      {dialog && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null) }}>
        <form className="tree-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={submitDialog}>
          <h2 id="dialog-title">{dialog.kind === 'branch' ? 'Nowa galaz' : dialog.kind === 'note' ? 'Nowa notatka' : dialog.kind === 'rename' ? 'Zmien nazwe' : 'Usun element?'}</h2>
          {dialog.kind === 'delete' ? <p>Czy na pewno usunac „{dialog.value}” wraz z zawartoscia?</p> : (
            <label>Nazwa<input autoFocus value={dialog.value} onChange={(event) => { setDialog({ ...dialog, value: event.target.value }); setDialogError('') }} maxLength={100} aria-describedby={dialogError ? 'dialog-error' : undefined} /></label>
          )}
          {dialogError && <p className="dialog-error" id="dialog-error" role="alert">{dialogError}</p>}
          <div className="dialog-actions">
            <button type="button" className="cancel-button" onClick={() => setDialog(null)}>Anuluj</button>
            <button type="submit" className={dialog.kind === 'delete' ? 'delete-button' : 'confirm-button'}>{dialog.kind === 'delete' ? 'Usun' : 'Zapisz'}</button>
          </div>
        </form>
      </div>}
      {!isHydrated && storageStatus === 'loading' && <div className="storage-loading" role="status">Wczytywanie notatek...</div>}
      {storageStatus === 'load-error' && <div className="storage-loading storage-recovery" role="alert">
        <div>
          <p>{loadError || 'Nie udalo sie odczytac lokalnych danych. Nie zostaly nadpisane.'}</p>
          <div className="recovery-actions">
            <button type="button" onClick={retryStorageLoad}>Ponow probe</button>
            <button type="button" onClick={resetStorageAfterConfirmation}>Usun dane i zacznij od nowa</button>
          </div>
        </div>
      </div>}
    </div>
  )
}

export default App