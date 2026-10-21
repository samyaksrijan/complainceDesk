export class PayloadTooLarge extends Error {
  constructor() { super("Request body is too large"); this.name = "PayloadTooLarge" }
}
/** Bound multipart memory usage before parsing, including requests without Content-Length. */
export async function boundedFormData(request: Request, maxBytes: number): Promise<FormData> {
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new PayloadTooLarge()
  const reader = request.body?.getReader()
  if (!reader) throw new SyntaxError("Request body is required")
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      total += chunk.value.byteLength
      if (total > maxBytes) { await reader.cancel(); throw new PayloadTooLarge() }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
  try { return await new Request(request.url, { method: "POST", headers: request.headers, body }).formData() }
  catch { throw new SyntaxError("Invalid multipart request") }
}
