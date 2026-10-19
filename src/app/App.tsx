import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type CSSProperties } from 'react'
import '@xyflow/react/dist/style.css'
import type { ImageBlock, Note, NoteBlock, TextBlock, TreeNode } from '../domain/model'
import { createId as makeId } from '../domain/ids'
import { createNote as makeNote, initialTree } from '../domain/initialTree'
import { findFirstNode, findNode, findNodePath, findParentNode, getImagesInNode, moveNode, removeNode, updateNode } from '../domain/tree'
import { deleteNotebook, loadNotebook, saveNotebook } from '../storage/indexedDb'
import NoteEditor from '../features/editor/NoteEditor'
import TreeGraph from '../features/graph/TreeGraph'
import './App.scss'

type DialogState = {
  kind: 'delete'
  nodeId?: string
  value: string
}

function findNamedNodes(node: TreeNode, query: string, path: string[] = []): { node: TreeNode; path: string[] }[] {
  return node.children.flatMap((child) => {
    const childPath = [...path, child.name]
    const matches = child.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    return [
      ...(matches ? [{ node: child, path: childPath }] : []),
      ...findNamedNodes(child, query, childPath),
    ]
  })
}

function App() {
  const [tree, setTree] = useState(initialTree)
  const [selectedId, setSelectedId] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [drawerWidthPercent, setDrawerWidthPercent] = useState<number | null>(null)
  const [isResizingDrawer, setIsResizingDrawer] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [editorMessage, setEditorMessage] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [storageStatus, setStorageStatus] = useState<'loading' | 'saving' | 'saved' | 'error' | 'load-error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saveRetry, setSaveRetry] = useState(0)
  const handleMoveNode = useCallback((movingId: string, targetId: string) => {
    setTree((currentTree) => moveNode(currentTree, movingId, targetId) ?? currentTree)
  }, [])
  const handleToggleNode = useCallback((id: string) => {
    setCollapsedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  }, [])
  const handleAddChild = useCallback((node: TreeNode) => {
    const parentNode = findNode(tree, node.id)
    if (!parentNode) return
    const baseName = 'Nowa notatka'
    let name = baseName
    let suffix = 2
    while (parentNode.children.some((child) => child.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      name = `${baseName} ${suffix}`
      suffix += 1
    }
    const child: TreeNode = { id: makeId(), name, note: makeNote(''), children: [] }
    setTree((current) => updateNode(current, parentNode.id, (parent) => ({ ...parent, children: [...parent.children, child] })))
    setCollapsedIds((ids) => ids.filter((id) => id !== parentNode.id))
    setSelectedId(child.id)
  }, [tree])
  const handleRemove = useCallback((node: TreeNode) => {
    setDialog({ kind: 'delete', nodeId: node.id, value: node.name })
  }, [])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const resizePointerIdRef = useRef<number | null>(null)
  const pendingDrawerWidthPercentRef = useRef<number | null>(null)
  const saveVersionRef = useRef(0)
  const selectedNode = findNode(tree, selectedId)
  const noteNode = selectedNode
  const searchResults = searchQuery.trim() ? findNamedNodes(tree, searchQuery.trim()) : []
  const breadcrumbNodes = noteNode
    ? (findNodePath(tree, noteNode.id) ?? []).filter((node) => node.id !== tree.id)
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

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsSidebarOpen(true)
        window.setTimeout(() => searchInputRef.current?.focus(), 0)
      } else if (event.key === 'Escape') {
        setIsSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  function selectSearchResult(node: TreeNode) {
    setSelectedId(node.id)
    const path = findNodePath(tree, node.id) ?? []
    const ancestorIds = new Set(path.slice(0, -1).map((item) => item.id))
    setCollapsedIds((ids) => ids.filter((id) => !ancestorIds.has(id)))
    setSearchQuery('')
  }

  function resizeDrawer(clientX: number, commit = true) {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0) return
    const minWidth = Math.min(360, bounds.width * 0.45)
    const maxWidth = bounds.width * 0.82
    const width = Math.max(minWidth, Math.min(maxWidth, bounds.right - clientX))
    const widthPercent = (width / bounds.width) * 100
    if (commit) {
      setDrawerWidthPercent(widthPercent)
      return
    }
    pendingDrawerWidthPercentRef.current = widthPercent
    stageRef.current?.style.setProperty('--drawer-width', `${widthPercent}%`)
  }

  function handleDrawerResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizePointerIdRef.current = event.pointerId
    setIsResizingDrawer(true)
  }

  function handleDrawerResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (resizePointerIdRef.current !== event.pointerId) return
    resizeDrawer(event.clientX, false)
  }

  function handleDrawerResizeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (resizePointerIdRef.current !== event.pointerId) return
    resizePointerIdRef.current = null
    if (pendingDrawerWidthPercentRef.current !== null) {
      setDrawerWidthPercent(pendingDrawerWidthPercentRef.current)
      pendingDrawerWidthPercentRef.current = null
    }
    setIsResizingDrawer(false)
  }

  function handleDrawerResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const stageBounds = stageRef.current?.getBoundingClientRect()
    const currentWidth = drawerRef.current?.getBoundingClientRect().width
    if (!stageBounds || !stageBounds.width || !currentWidth) return
    const delta = event.key === 'ArrowLeft' ? 20 : -20
    resizeDrawer(stageBounds.right - currentWidth - delta)
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
      setSelectedId(findFirstNode(initialTree)?.id ?? '')
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
        setSelectedId(findFirstNode(nextTree)?.id ?? '')
      }
      setCollapsedIds((ids) => ids.filter((id) => id !== dialog.nodeId))
      setDialog(null)
      return
    }

    setDialog(null)
  }

  function renameSelectedNote(value: string): string | null {
    if (!noteNode) return 'Nie mozna znalezc notatki.'
    const name = value.trim()
    if (!name) return 'Nazwa nie moze byc pusta.'
    if (name.length > 100) return 'Nazwa moze miec maksymalnie 100 znakow.'
    const parentNode = findParentNode(tree, noteNode.id)
    if (!parentNode) return 'Wybrany element juz nie istnieje.'
    if (parentNode.children.some((node) => node.id !== noteNode.id && node.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return 'Element o tej nazwie juz istnieje w tej galezi.'
    }
    if (name !== noteNode.name) {
      setTree((current) => updateNode(current, noteNode.id, (node) => ({ ...node, name })))
    }
    return null
  }

  function updateSelectedNote(update: (note: Note) => Note) {
    if (!noteNode) return
    const nodeId = noteNode.id
    setTree((current) => updateNode(current, nodeId, (node) => ({
      ...node,
      note: { ...update(node.note), updatedAt: new Date().toISOString() },
    })))
  }

  function updateBlock(blockId: string, update: (block: NoteBlock) => NoteBlock) {
    updateSelectedNote((note) => ({
      ...note,
      blocks: note.blocks.map((block) => block.id === blockId ? update(block) : block),
    }))
  }

  function addTextBlock() {
    if (!noteNode) return
    const block: TextBlock = {
      id: makeId(), type: 'text', text: '', x: 8,
      y: Math.max(20, ...noteNode.note.blocks.map((item) => (item.y ?? 20) + 170)),
      width: 82,
    }
    updateSelectedNote((note) => ({ ...note, blocks: [...note.blocks, block] }))
    setEditorMessage('Dodano pole tekstowe.')
  }

  async function addImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !noteNode) return
    const targetNodeId = noteNode.id
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
    if (selectedId !== targetNodeId) {
      setEditorMessage('Notatka zmienila sie podczas sprawdzania obrazu. Sprobuj ponownie.')
      return
    }
    const target = findNode(tree, targetNodeId)
    if (!target) return
    const imageWidth = 48
    const block: ImageBlock = {
      id: makeId(), type: 'image', blob: file,
      x: (100 - imageWidth) / 2,
      y: Math.max(20, ...target.note.blocks.map((item) => (item.y ?? 20) + 190)),
      altText: file.name, caption: '', width: imageWidth, alignment: 'center',
    }
    const imageUrl = URL.createObjectURL(file)
    setImageUrls((current) => ({ ...current, [block.id]: imageUrl }))
    updateSelectedNote((note) => ({ ...note, blocks: [...note.blocks, block] }))
    setEditorMessage('Dodano obraz.')
  }

  function moveCanvasBlock(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!noteNode) return
    const blockId = event.dataTransfer.getData('application/x-note-block')
    const block = noteNode.note.blocks.find((item) => item.id === blockId)
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!block || bounds.width === 0) return
    const nextX = Math.max(0, Math.min(100 - (block.width ?? 82), ((event.clientX - bounds.left) / bounds.width) * 100))
    const nextY = Math.max(0, event.clientY - bounds.top - 18)
    updateBlock(blockId, (current) => ({ ...current, x: nextX, y: nextY }))
  }

  function removeBlock(blockId: string) {
    const block = noteNode?.note.blocks.find((item) => item.id === blockId)
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

  return (
    <div className="notebook">
      <aside id="sidebar-panel" className={`sidebar${isSidebarOpen ? ' sidebar--open' : ''}`} aria-hidden={!isSidebarOpen} inert={!isSidebarOpen}>
        <a className="sidebar__brand" href="#main-content">
          <span className="sidebar__brand-mark" aria-hidden="true">GM</span>
          <span className="sidebar__brand-name">Game Master<span>Notebook</span></span>
        </a>
        <div className="sidebar__tools">
          <label className="sidebar__search">
            <span className="sidebar__search-icon" aria-hidden="true">/</span>
            <input ref={searchInputRef} className="sidebar__search-input" type="search" placeholder="Szukaj notatek" aria-label="Szukaj notatek" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            <kbd className="sidebar__search-shortcut">Ctrl K</kbd>
          </label>
          <button className="sidebar__action sidebar__action--primary" type="button" onClick={() => handleAddChild(findNode(tree, selectedId) ?? tree)}><span className="sidebar__action-icon" aria-hidden="true">+</span> Nowa notatka</button>
        </div>
        {searchQuery.trim() && <section className="sidebar__results" aria-label="Wyniki wyszukiwania">
          {searchResults.length > 0 ? searchResults.map(({ node, path }) => (
            <button className="sidebar__result" key={node.id} type="button" onClick={() => selectSearchResult(node)}>
              <span className="sidebar__result-name">{node.name}</span>
              <span className="sidebar__result-path">{path.slice(0, -1).join(' / ')}</span>
            </button>
          )) : <p className="sidebar__no-results">Nie znaleziono notatek</p>}
        </section>}
      </aside>
      <main className="workspace" id="main-content">
        <section className="graph-view">
          <header className="graph-view__header">
            <button
              className="graph-view__menu-toggle"
              type="button"
              aria-label={isSidebarOpen ? 'Zamknij panel boczny' : 'Otworz panel boczny'}
              aria-expanded={isSidebarOpen}
              aria-controls="sidebar-panel"
              title={isSidebarOpen ? 'Zamknij panel boczny' : 'Otworz panel boczny'}
              onClick={() => setIsSidebarOpen((open) => !open)}
            ><span className="graph-view__menu-icon" aria-hidden="true"><i /><i /><i /></span></button>
            <div className="graph-view__status-actions">
              <span className={`graph-view__save-status graph-view__save-status--${storageStatus}`} aria-live="polite">
                {storageStatus === 'loading' || storageStatus === 'load-error' ? 'Wczytywanie...' : storageStatus === 'saving' ? 'Zapisywanie...' : storageStatus === 'error' ? 'Blad zapisu' : 'Zapisano lokalnie'}
              </span>
              {storageStatus === 'error' && <button className="graph-view__retry" type="button" onClick={() => setSaveRetry((retry) => retry + 1)}>Ponow zapis</button>}
            </div>
          </header>
          <div
            ref={stageRef}
            className={`graph-view__stage${noteNode ? ' graph-view__stage--with-drawer' : ''}${isResizingDrawer ? ' graph-view__stage--resizing' : ''}`}
            style={drawerWidthPercent === null ? undefined : { '--drawer-width': `${drawerWidthPercent}%` } as CSSProperties}
          >
            <div className="graph-view__canvas">
              <TreeGraph
                tree={tree}
                selectedId={selectedId}
                collapsedIds={collapsedIds}
                onSelectNode={setSelectedId}
                onToggleNode={handleToggleNode}
                onAddChild={handleAddChild}
                onRemove={handleRemove}
                onMoveNode={handleMoveNode}
              />
            </div>
            <aside ref={drawerRef} className={`note-drawer${noteNode ? ' note-drawer--open' : ''}`} aria-hidden={!noteNode} inert={!noteNode}>
              <div
                className="note-drawer__resize-handle"
                role="separator"
                aria-label="Zmien szerokosc panelu notatki"
                aria-orientation="vertical"
                aria-valuenow={drawerWidthPercent === null ? 46 : Math.round(drawerWidthPercent)}
                aria-valuemin={45}
                aria-valuemax={82}
                tabIndex={0}
                onPointerDown={handleDrawerResizeStart}
                onPointerMove={handleDrawerResizeMove}
                onPointerUp={handleDrawerResizeEnd}
                onPointerCancel={handleDrawerResizeEnd}
                onLostPointerCapture={handleDrawerResizeEnd}
                onKeyDown={handleDrawerResizeKeyDown}
              />
              {noteNode && <>
                <header className="note-drawer__header">
                  <nav className="note-drawer__breadcrumbs" aria-label="Sciezka notatki">
                    {breadcrumbNodes.map((node) => <span key={node.id}>{node.name}<i aria-hidden="true">/</i></span>)}
                    <strong>{noteNode.name}</strong>
                  </nav>
                  <button className="note-drawer__close" type="button" aria-label="Zamknij notatke" onClick={() => setSelectedId('')}>x</button>
                </header>
                <div className="note-drawer__scroll">
                  <NoteEditor
                    key={noteNode.id}
                    title={noteNode.name}
                    onRename={renameSelectedNote}
                    updatedAt={noteNode.note.updatedAt}
                    blocks={noteNode.note.blocks}
                    imageUrls={imageUrls}
                    editorMessage={editorMessage}
                    imageInputRef={imageInputRef}
                    onAddText={addTextBlock}
                    onAddImage={addImage}
                    onUpdateBlock={updateBlock}
                    onMoveBlock={moveCanvasBlock}
                    onRemoveBlock={removeBlock}
                  />
                </div>
              </>}
            </aside>
          </div>
        </section>
      </main>
      {isSidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Zamknij panel boczny" onClick={() => setIsSidebarOpen(false)} />}
      {dialog && <div className="dialog__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null) }}>
        <form className="dialog__form" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={submitDialog}>
          <h2 className="dialog__title" id="dialog-title">Usun element?</h2>
          <p className="dialog__copy">Czy na pewno usunac „{dialog.value}” wraz z zawartoscia?</p>
          <div className="dialog__actions">
            <button type="button" className="dialog__button" onClick={() => setDialog(null)}>Anuluj</button>
            <button type="submit" className="dialog__button dialog__button--delete">Usun</button>
          </div>
        </form>
      </div>}
      {!isHydrated && storageStatus === 'loading' && <div className="storage-state" role="status">Wczytywanie notatek...</div>}
      {storageStatus === 'load-error' && <div className="storage-state storage-state--recovery" role="alert">
        <div>
          <p className="storage-state__message">{loadError || 'Nie udalo sie odczytac lokalnych danych. Nie zostaly nadpisane.'}</p>
          <div className="storage-state__actions">
            <button className="storage-state__button" type="button" onClick={retryStorageLoad}>Ponow probe</button>
            <button className="storage-state__button storage-state__button--danger" type="button" onClick={resetStorageAfterConfirmation}>Usun dane i zacznij od nowa</button>
          </div>
        </div>
      </div>}
    </div>
  )
}

export default App