import type { ChangeEvent, DragEvent, RefObject } from 'react'
import type { ImageBlock, NoteBlock } from '../../domain/model'
import './NoteEditor.css'

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
  onNudgeBlock: (blockId: string, horizontal: number, vertical: number) => void
  onRemoveBlock: (blockId: string) => void
  onAlignImage: (block: ImageBlock, alignment: ImageBlock['alignment']) => void
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
  onNudgeBlock,
  onRemoveBlock,
  onAlignImage,
}: NoteEditorProps) {
  return (
    <article className="note-page drawer-note">
      <div className="page-kicker"><span />NOTATKA</div>
      <h1>{title}</h1>
      <div className="note-metadata">Ostatnia edycja: {new Date(updatedAt).toLocaleDateString()}</div>
      <hr />
      <div className="canvas-toolbar">
        <button type="button" onClick={onAddText}>+ Tekst</button>
        <button type="button" onClick={() => imageInputRef.current?.click()}>+ Obraz</button>
        <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={onAddImage} />
        <span role="status" aria-live="polite">{editorMessage}</span>
      </div>
      <div className="note-canvas" onDragOver={(event) => event.preventDefault()} onDrop={onMoveBlock}>
        {blocks.map((block) => (
          <section
            className={`canvas-block ${block.type === 'text' ? 'text-canvas-block' : 'image-canvas-block'}`}
            key={block.id}
            style={{ left: `${block.x ?? 8}%`, top: `${block.y ?? 20}px`, width: `${block.width ?? 82}%` }}
          >
            <div className="block-toolbar">
              <button className="block-grab" type="button" draggable aria-label="Przeciagnij blok" title="Przeciagnij, aby zmienic polozenie" onDragStart={(event) => event.dataTransfer.setData('application/x-note-block', block.id)}>⠿</button>
              <div className="block-nudges" role="group" aria-label="Polozenie bloku">
                <button type="button" aria-label="Przesun w lewo" onClick={() => onNudgeBlock(block.id, -2, 0)}>←</button>
                <button type="button" aria-label="Przesun w gore" onClick={() => onNudgeBlock(block.id, 0, -20)}>↑</button>
                <button type="button" aria-label="Przesun w dol" onClick={() => onNudgeBlock(block.id, 0, 20)}>↓</button>
                <button type="button" aria-label="Przesun w prawo" onClick={() => onNudgeBlock(block.id, 2, 0)}>→</button>
              </div>
              <span>{block.type === 'text' ? 'Tekst' : 'Obraz'}</span>
              <button className="block-remove" type="button" aria-label="Usun blok" onClick={() => onRemoveBlock(block.id)}>x</button>
            </div>
            {block.type === 'text' ? (
              <textarea
                className="note-textarea"
                aria-label="Tresc bloku tekstowego"
                placeholder="Wpisz tekst..."
                value={block.text}
                rows={4}
                onChange={(event) => onUpdateBlock(block.id, (current) => current.type === 'text' ? { ...current, text: event.target.value } : current)}
              />
            ) : (
              <>
                <figure className="canvas-figure">
                  {imageUrls[block.id] && <img className="canvas-image" src={imageUrls[block.id]} alt={block.altText} />}
                  {block.caption && <figcaption className="image-caption">{block.caption}</figcaption>}
                </figure>
                <div className="image-settings">
                  <label className="image-width-control">Szerokosc <strong>{block.width}%</strong>
                    <input type="range" min="20" max="100" step="2" value={block.width} aria-label="Szerokosc obrazu" onChange={(event) => {
                      const width = Number(event.target.value)
                      onUpdateBlock(block.id, (current) => current.type === 'image' ? { ...current, width, x: Math.min(current.x ?? 8, 100 - width) } : current)
                    }} />
                  </label>
                  <div className="image-alignment" role="group" aria-label="Wyrownanie obrazu">
                    {(['left', 'center', 'right'] as const).map((alignment) => (
                      <button type="button" key={alignment} aria-label={alignment === 'left' ? 'Wyrownaj do lewej' : alignment === 'center' ? 'Wyrownaj do srodka' : 'Wyrownaj do prawej'} aria-pressed={block.alignment === alignment} onClick={() => onAlignImage(block, alignment)}>{alignment === 'left' ? 'L' : alignment === 'center' ? 'C' : 'P'}</button>
                    ))}
                  </div>
                  <label className="image-text-field">Tekst alternatywny<input value={block.altText} onChange={(event) => onUpdateBlock(block.id, (current) => current.type === 'image' ? { ...current, altText: event.target.value } : current)} /></label>
                  <label className="image-text-field">Podpis<input value={block.caption} onChange={(event) => onUpdateBlock(block.id, (current) => current.type === 'image' ? { ...current, caption: event.target.value } : current)} /></label>
                </div>
              </>
            )}
          </section>
        ))}
        {blocks.length === 0 && <p className="canvas-empty">Dodaj blok tekstu albo obraz.</p>}
      </div>
    </article>
  )
}