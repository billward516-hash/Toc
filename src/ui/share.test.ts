import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ on: true, writeFile: vi.fn(), share: vi.fn() }))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on } }))
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: native.writeFile } }))
vi.mock('@capacitor/share', () => ({ Share: { share: native.share } }))

import { shareOrSave } from './share.ts'

// The certificate in the Android app goes to the cache folder and then to Android's share sheet.
describe('shareOrSave in the Android app', () => {
  const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'Factory-Fun-certificate-sam.pdf', { type: 'application/pdf' })

  beforeEach(() => {
    native.on = true
    native.writeFile.mockReset().mockResolvedValue({ uri: 'file:///cache/Factory-Fun-certificate-sam.pdf' })
    native.share.mockReset().mockResolvedValue({ activityType: 'x' })
  })

  it('writes the file to the cache and shares it', async () => {
    expect(await shareOrSave(file)).toBe('shared')
    expect(native.writeFile).toHaveBeenCalledWith({ path: file.name, data: btoa('%PDF-'), directory: 'CACHE' })
    expect(native.share).toHaveBeenCalledWith({ title: file.name, files: ['file:///cache/Factory-Fun-certificate-sam.pdf'] })
  })

  it('treats a closed share sheet as no error', async () => {
    native.share.mockRejectedValue(new Error('Share canceled'))
    expect(await shareOrSave(file)).toBe('cancelled')
  })

  it('encodes a file bigger than one chunk without losing a byte', async () => {
    const big = new File([new Uint8Array(100_000).map((_, i) => i % 251)], 'big.pdf')
    await shareOrSave(big)
    const written = native.writeFile.mock.calls[0]![0].data as string
    const back = Uint8Array.from(atob(written), (c) => c.charCodeAt(0))
    expect(back.length).toBe(100_000)
    expect(back[99_999]).toBe(99_999 % 251)
  })

  it('does not touch the native plugins in a browser', async () => {
    native.on = false
    // A browser with no share sheet saves a download instead, which needs a page; here only that it was not native.
    await shareOrSave(file).catch(() => {})
    expect(native.writeFile).not.toHaveBeenCalled()
  })
})
