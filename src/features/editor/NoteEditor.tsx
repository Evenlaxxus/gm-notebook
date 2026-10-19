import { useRef, type ChangeEvent, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { NoteBlock } from '../../domain/model'
import './NoteEditor.scss'

type NoteEditorProps = {
  title: string
  updatedAt: string
  blocks: NoteBlock[]
  imageUrls: Record<string, string>
  editorMessage: string
  imageInputRef: RefObject<HTMLInputElement | null>
  onAddText: () => void
  onAddImage: (event: ChangeEvent<HTMLInputElement>) => void
  onUpdateBlock: (blockId: string, update: (block: NoteBlock) => NoteBlock) => void
  onMoveBlock: (event: DragEvent<HTMLDivElement>) => void
  onRemoveBlock: (blockId: string) => void
}

export default function NoteEditor({
  title,
  updatedAt,
  blocks,
  imageUrls,
  editorMessage,
  imageInputRef,
  onAddText,
  onAddImage,
  onUpdateBlock,
  onMoveBlock,
  onRemoveBlock,
}: NoteEditorProps) {
  const imageResizeRef = useRef<{ pointerId: number; clientX: number; width: number; x: number; canvasWidth: number } | null>(null)
  const textResizeRef = useRef<{ pointerId: number; clientX: number; clientY: number; width: number; height: number; x: number; canvasWidth: number } | null>(null)

  function startTextResize(event: ReactPointerEvent<HTMLButtonElement>, block: Extract<NoteBlock, { type: 'text' }>) {
    event.preventDefault()
    event.stopPropagation()
    const canvas = event.currentTarget.closest('.note-editor__canvas')
    const blockElement = event.currentTarget.closest('.note-editor__block')
    const canvasWidth = canvas?.getBoundingClientRect().width ?? 0
    const blockHeight = blockElement?.getBoundingClientRect().height ?? 0
    if (canvasWidth === 0 || blockHeight === 0) return
    textResizeRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      width: block.width ?? 82,
      height: block.height ?? blockHeight,
      x: block.x ?? 8,
      canvasWidth,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function resizeText(event: ReactPointerEvent<HTMLButtonElement>, blockId: string) {
    const resize = textResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const minWidth = Math.min((180 / resize.canvasWidth) * 100, 100 - resize.x)
    const width = Math.max(minWidth, Math.min(100 - resize.x, resize.width + ((event.clientX - resize.clientX) / resize.canvasWidth) * 100))
    const height = Math.max(106, resize.height + event.clientY - resize.clientY)
    onUpdateBlock(blockId, (current) => current.type === 'text' ? { ...current, width, height } : current)
  }

  function finishTextResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (textResizeRef.current?.pointerId === event.pointerId) textResizeRef.current = null
  }

  function resizeTextWithKeyboard(event: ReactKeyboardEvent<HTMLButtonElement>, block: Extract<NoteBlock, { type: 'text' }>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const canvasWidth = event.currentTarget.closest('.note-editor__canvas')?.getBoundingClientRect().width ?? 0
    const blockHeight = event.currentTarget.closest('.note-editor__block')?.getBoundingClientRect().height ?? 106
    if (canvasWidth === 0) return
    const step = event.shiftKey ? 10 : 2
    const minWidth = Math.min((180 / canvasWidth) * 100, 100 - (block.x ?? 8))
    const width = Math.max(minWidth, Math.min(100 - (block.x ?? 8), (block.width ?? 82) + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)))
    const heightStep = event.shiftKey ? 50 : 20
    const height = Math.max(106, (block.height ?? blockHeight) + (event.key === 'ArrowDown' ? heightStep : event.key === 'ArrowUp' ? -heightStep : 0))
    onUpdateBlock(block.id, (current) => current.type === 'text' ? { ...current, width, height } : current)
  }

  function startImageResize(event: ReactPointerEvent<HTMLButtonElement>, block: Extract<NoteBlock, { type: 'image' }>) {
    event.preventDefault()
    event.stopPropagation()
    const canvasWidth = event.currentTarget.closest('.note-editor__canvas')?.getBoundingClientRect().width ?? 0
    if (canvasWidth === 0) return
    imageResizeRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      width: block.width,
      x: block.x ?? 8,
      canvasWidth,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function resizeImage(event: ReactPointerEvent<HTMLButtonElement>, blockId: string) {
    const resize = imageResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const width = Math.max(20, Math.min(100, resize.width + ((event.clientX - resize.clientX) / resize.canvasWidth) * 100))
    onUpdateBlock(blockId, (current) => current.type === 'image'
      ? { ...current, width, x: Math.min(resize.x, 100 - width) }
      : current)
  }

  function finishImageResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (imageResizeRef.current?.pointerId === event.pointerId) imageResizeRef.current = null
  }

  return (
    <article className="note-editor">
      <div className="note-editor__kicker"><span />NOTATKA</div>
      <h1 className="note-editor__title">{title}</h1>
      <div className="note-editor__metadata">Ostatnia edycja: {new Date(updatedAt).toLocaleDateString()}</div>
      <hr className="note-editor__divider" />
      <div className="note-editor__toolbar">
        <button type="button" onClick={onAddText}>+ Tekst</button>
        <button type="button" onClick={() => imageInputRef.current?.click()}>+ Obraz</button>
        <input ref={imageInputRef} className="note-editor__file-input" type="file" accept="image/*" onChange={onAddImage} />
        <span className="note-editor__status" role="status" aria-live="polite">{editorMessage}</span>
      </div>
      <div className="note-editor__canvas" onDragOver={(event) => event.preventDefault()} onDrop={onMoveBlock}>
        {blocks.map((block) => (
          <section
            className={`note-editor__block note-editor__block--${block.type}`}
            key={block.id}
            draggable
            onDragStart={(event) => {
              if (event.target instanceof Element && event.target.closest('button')) {
                event.preventDefault()
                return
              }
              const bounds = event.currentTarget.getBoundingClientRect()
              const edge = 12
              const fromBorder = event.clientX - bounds.left <= edge
                || bounds.right - event.clientX <= edge
                || event.clientY - bounds.top <= edge
                || bounds.bottom - event.clientY <= edge
              if (!fromBorder) {
                event.preventDefault()
                return
              }
              event.dataTransfer.setData('application/x-note-block', block.id)
            }}
            style={{ left: `${block.x ?? 8}%`, top: `${block.y ?? 20}px`, width: `${block.width ?? 82}%` }}
          >
            {block.type === 'text' ? (
              <>
                <button className="note-editor__block-remove" type="button" aria-label="Usun blok" onClick={() => onRemoveBlock(block.id)}>x</button>
                <textarea
                  className="note-editor__textarea"
                  aria-label="Tresc bloku tekstowego"
                  placeholder="Wpisz tekst..."
                  value={block.text}
                  rows={4}
                  style={block.height ? { height: `${block.height}px` } : undefined}
                  onChange={(event) => onUpdateBlock(block.id, (current) => current.type === 'text' ? { ...current, text: event.target.value } : current)}
                />
                <button
                  className="note-editor__text-resize"
                  type="button"
                  aria-label="Zmien szerokosc i wysokosc bloku tekstowego"
                  title="Przeciagnij, aby zmienic szerokosc i wysokosc"
                  onPointerDown={(event) => startTextResize(event, block)}
                  onPointerMove={(event) => resizeText(event, block.id)}
                  onPointerUp={finishTextResize}
                  onPointerCancel={finishTextResize}
                  onLostPointerCapture={finishTextResize}
                  onKeyDown={(event) => resizeTextWithKeyboard(event, block)}
                />
              </>
            ) : (
              <>
                <button className="note-editor__block-remove" type="button" aria-label="Usun blok" onClick={() => onRemoveBlock(block.id)}>x</button>
                <figure className="note-editor__figure">
                  {imageUrls[block.id] && <img className="note-editor__image" src={imageUrls[block.id]} alt={block.altText} draggable={false} />}
                  {block.caption && <figcaption className="note-editor__caption">{block.caption}</figcaption>}
                </figure>
                <button
                  className="note-editor__image-resize"
                  type="button"
                  aria-label="Zmien rozmiar obrazu"
                  title="Przeciagnij naroznik, aby zmienic rozmiar"
                  onPointerDown={(event) => startImageResize(event, block)}
                  onPointerMove={(event) => resizeImage(event, block.id)}
                  onPointerUp={finishImageResize}
                  onPointerCancel={finishImageResize}
                  onLostPointerCapture={finishImageResize}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                    event.preventDefault()
                    const width = Math.max(20, Math.min(100, block.width + (event.key === 'ArrowRight' ? 2 : -2)))
                    onUpdateBlock(block.id, (current) => current.type === 'image'
                      ? { ...current, width, x: Math.min(current.x ?? 8, 100 - width) }
                      : current)
                  }}
                />
              </>
            )}
          </section>
        ))}
        {blocks.length === 0 && <p className="note-editor__empty">Dodaj blok tekstu albo obraz.</p>}
      </div>
    </article>
  )
}