/**
 * Remote output decoding.
 *
 * OpenSSH forwards whatever bytes the remote side wrote. A UTF-8 host emits
 * UTF-8; a Windows host whose console code page is 936 emits GBK, and `chcp
 * 65001` only changes the code page for commands that were not already started,
 * which is why the usual advice does not fix the mojibake users see. The plugin
 * therefore decodes the bytes itself.
 *
 * `auto` tries strict UTF-8 first and falls back to GBK when the bytes are not
 * valid UTF-8. That is safe for the common cases: GBK text is almost never valid
 * UTF-8, and ASCII (the bulk of shell output) is identical in both.
 */

/** Preference values accepted from config. */
export const ENCODING_KINDS = ['auto', 'utf8', 'gbk']

const UTF8 = 'utf-8'
const GBK = 'gbk'

/** Whether this Node build can decode GBK (it needs full ICU). */
let gbkTested = false
let gbkWorks = false

function gbkSupported() {
  if (!gbkTested) {
    gbkTested = true
    try {
      new TextDecoder(GBK)
      gbkWorks = true
    } catch {
      gbkWorks = false
    }
  }
  return gbkWorks
}

/** A short human-readable label for an encoding choice. */
function labelOf(encoding) {
  return encoding === GBK ? 'gbk' : 'utf-8'
}

/**
 * Decode one complete byte buffer.
 * @param buffer - the bytes OpenSSH forwarded for one stream.
 * @param preference - `auto`, `utf8` or `gbk`.
 * @returns `{ text, encoding, lossy }`; `lossy` marks bytes that could not be
 * decoded (invalid GBK, or GBK wanted but no ICU in this Node build).
 */
export function decodeOutput(buffer, preference = 'auto') {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer ?? '')
  if (bytes.length === 0) return { text: '', encoding: UTF8, lossy: false }
  if (preference === 'gbk') {
    if (gbkSupported()) {
      return { text: new TextDecoder(GBK).decode(bytes), encoding: GBK, lossy: false }
    }
    return { text: new TextDecoder(UTF8).decode(bytes), encoding: UTF8, lossy: true }
  }
  if (preference === 'utf8') {
    return { text: new TextDecoder(UTF8).decode(bytes), encoding: UTF8, lossy: false }
  }
  try {
    return { text: new TextDecoder(UTF8, { fatal: true }).decode(bytes), encoding: UTF8, lossy: false }
  } catch {
    if (gbkSupported()) {
      return { text: new TextDecoder(GBK).decode(bytes), encoding: GBK, lossy: false }
    }
    return { text: new TextDecoder(UTF8).decode(bytes), encoding: UTF8, lossy: true }
  }
}

/**
 * Classify a byte buffer as UTF-8: complete, truncated mid-sequence, or invalid.
 * Only an incomplete tail at the very end counts as `incomplete`, so the live
 * decoder can hold it for the next chunk.
 */
export function validateUtf8(buffer) {
  const bytes = buffer
  let index = 0
  while (index < bytes.length) {
    const lead = bytes[index]
    if (lead < 0x80) {
      index += 1
      continue
    }
    let length
    if (lead >= 0xc2 && lead <= 0xdf) length = 1
    else if (lead >= 0xe0 && lead <= 0xef) length = 2
    else if (lead >= 0xf0 && lead <= 0xf4) length = 3
    else return 'invalid'
    const available = bytes.length - index - 1
    if (available < length) {
      for (let step = 1; step <= available; step += 1) {
        if ((bytes[index + step] & 0xc0) !== 0x80) return 'invalid'
      }
      return 'incomplete'
    }
    const second = bytes[index + 1]
    if ((second & 0xc0) !== 0x80) return 'invalid'
    // Reject overlong forms and UTF-16 surrogates that a loose validator accepts.
    if (lead === 0xe0 && second < 0xa0) return 'invalid'
    if (lead === 0xed && second >= 0xa0) return 'invalid'
    if (lead === 0xf0 && second < 0x90) return 'invalid'
    if (lead === 0xf4 && second >= 0x90) return 'invalid'
    for (let step = 2; step <= length; step += 1) {
      if ((bytes[index + step] & 0xc0) !== 0x80) return 'invalid'
    }
    index += length + 1
  }
  return 'valid'
}

function isAscii(buffer) {
  for (const byte of buffer) {
    if (byte >= 0x80) return false
  }
  return true
}

/**
 * A streaming decoder for the live panel.
 *
 * With `auto`, bytes are not guessed one chunk at a time: ASCII is emitted at
 * once (it means the same in both encodings), and the first non-ASCII run is
 * held until one byte proves the stream invalid UTF-8 (then everything is
 * re-decoded as GBK) or enough valid UTF-8 has accumulated to accept it. That
 * avoids showing a replacement-character burst that never goes away.
 */
export function createLiveDecoder(preference = 'auto') {
  /** `unknown` only in auto mode before the stream committed. */
  let mode = preference === 'auto' ? 'unknown' : preference === 'gbk' ? GBK : UTF8
  if (mode === GBK && !gbkSupported()) mode = UTF8
  let pending = Buffer.alloc(0)
  let stream
  if (mode !== 'unknown') stream = new TextDecoder(mode === GBK ? GBK : UTF8)
  const headroom = 256

  const decoderFor = (chosen) => new TextDecoder(chosen === GBK ? GBK : UTF8)

  return {
    /** The encoding committed so far, or '' while still undecided. */
    get encoding() {
      return mode === 'unknown' ? '' : labelOf(mode)
    },
    /** Decode the next chunk; returns only newly decoded text. */
    push(chunk) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk ?? '')
      if (bytes.length === 0) return ''
      if (mode !== 'unknown') return stream.decode(bytes, { stream: true })
      if (pending.length === 0 && isAscii(bytes)) {
        // ASCII decodes identically under UTF-8 and GBK, so it can go out now.
        return bytes.toString('utf8')
      }
      pending = pending.length === 0 ? bytes : Buffer.concat([pending, bytes])
      const verdict = validateUtf8(pending)
      if (verdict === 'invalid') {
        mode = GBK
        stream = decoderFor(GBK)
        const text = stream.decode(pending, { stream: true })
        pending = Buffer.alloc(0)
        return text
      }
      if (verdict === 'valid' && pending.length >= headroom) {
        mode = UTF8
        stream = decoderFor(UTF8)
        const text = stream.decode(pending, { stream: true })
        pending = Buffer.alloc(0)
        return text
      }
      return ''
    },
    /** Flush the tail at end of stream. */
    flush() {
      if (mode === 'unknown') {
        if (pending.length === 0) return ''
        const decoded = decodeOutput(pending, 'auto')
        mode = decoded.encoding
        pending = Buffer.alloc(0)
        return decoded.text
      }
      return stream.decode()
    },
  }
}

export { GBK, UTF8, gbkSupported, labelOf }
