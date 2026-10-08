import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

class TestResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    const isNode = target.classList.contains('react-flow__node-notebookNode')
    const width = isNode ? 226 : 1200
    const height = isNode ? 54 : 800
    const rect = { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) } as DOMRectReadOnly
    this.callback([{
      target,
      contentRect: rect,
      borderBoxSize: [{ inlineSize: width, blockSize: height }],
      contentBoxSize: [{ inlineSize: width, blockSize: height }],
      devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
    } as ResizeObserverEntry], this)
  }

  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: TestResizeObserver,
})

let objectUrlCounter = 0

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: vi.fn(() => `blob:gm-notebook-test-${++objectUrlCounter}`),
})

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: vi.fn(),
})

if (typeof crypto.randomUUID !== 'function') {
  let uuidCounter = 0
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => `test-id-${++uuidCounter}`,
  })
}

afterEach(() => cleanup())