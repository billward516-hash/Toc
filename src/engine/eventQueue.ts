interface Entry<P> {
  t: number
  seq: number
  payload: P
}

// Min-heap by time; events at the same time come out in the order they were scheduled,
// so every run with the same seed replays identically.
export class EventQueue<P> {
  #heap: Entry<P>[] = []
  #nextSeq = 0

  get size() {
    return this.#heap.length
  }

  peekTime(): number | undefined {
    return this.#heap[0]?.t
  }

  push(t: number, payload: P) {
    const heap = this.#heap
    heap.push({ t, seq: this.#nextSeq++, payload })
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!before(heap[i], heap[parent])) break
      swap(heap, i, parent)
      i = parent
    }
  }

  pop(): { t: number; payload: P } | undefined {
    const heap = this.#heap
    const top = heap[0]
    const last = heap.pop()
    if (heap.length > 0 && last) {
      heap[0] = last
      let i = 0
      for (;;) {
        const left = 2 * i + 1
        const right = left + 1
        let smallest = i
        if (left < heap.length && before(heap[left], heap[smallest])) smallest = left
        if (right < heap.length && before(heap[right], heap[smallest])) smallest = right
        if (smallest === i) break
        swap(heap, i, smallest)
        i = smallest
      }
    }
    return top && { t: top.t, payload: top.payload }
  }
}

function before<P>(a: Entry<P>, b: Entry<P>) {
  return a.t < b.t || (a.t === b.t && a.seq < b.seq)
}

function swap<T>(items: T[], i: number, j: number) {
  const held = items[i]
  items[i] = items[j]
  items[j] = held
}
