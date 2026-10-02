/* Sync for Sight Words. Everything else on the site is a static file in public/ and never reaches
   this Worker. There are no accounts: a family's progress is one row keyed by a random 20-character
   code, and knowing the code is what lets a device read and write it.

   GET /api/sync/CODE  -> 200 { version, data } | 404
   PUT /api/sync/CODE  { version, data } -> 200 { version } when `version` is the one stored (0 creates);
                       otherwise 409 with what is stored, so the device takes that instead. */
const CODE = /^[0-9A-HJKMNP-TV-Z]{20}$/; // Crockford base32, 100 bits
const MAX_CHARS = 256 * 1024;

export default {
  async fetch(request, env) {
    const m = new URL(request.url).pathname.match(/^\/api\/sync\/([^/]+)$/);
    if (!m) return json({ error: "not found" }, 404);
    const code = m[1];
    if (!CODE.test(code)) return json({ error: "bad code" }, 400);

    if (request.method === "GET") {
      const row = await stored(env, code);
      return row ? json(row) : json({ error: "not found" }, 404);
    }
    if (request.method !== "PUT") return json({ error: "method not allowed" }, 405, { Allow: "GET, PUT" });

    const text = await request.text();
    if (text.length > MAX_CHARS) return json({ error: "too large" }, 413);
    let body = null;
    try { body = JSON.parse(text); } catch (e) {}
    const base = body && body.version, data = body && body.data;
    if (!Number.isInteger(base) || base < 0 || !data || data.v !== 1) return json({ error: "bad request" }, 400);

    const now = Date.now(), dataText = JSON.stringify(data);
    const result = base === 0
      ? await env.DB.prepare("INSERT INTO progress (code, version, data, updated_at) VALUES (?1, 1, ?2, ?3) ON CONFLICT(code) DO NOTHING")
        .bind(code, dataText, now).run()
      : await env.DB.prepare("UPDATE progress SET version = version + 1, data = ?2, updated_at = ?3 WHERE code = ?1 AND version = ?4")
        .bind(code, dataText, now, base).run();
    if (result.meta.changes === 1) return json({ version: base + 1 });

    const row = await stored(env, code);
    return row ? json(row, 409) : json({ error: "not found" }, 404);
  }
};

async function stored(env, code) {
  const row = await env.DB.prepare("SELECT version, data FROM progress WHERE code = ?1").bind(code).first();
  return row && { version: row.version, data: JSON.parse(row.data) };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }
  });
}
