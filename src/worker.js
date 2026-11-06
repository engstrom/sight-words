/* Sync for Sight Words. Everything else on the site is a static file in public/ and never reaches
   this Worker. There are no accounts: everything one child's grown-ups share is keyed by a random
   20-character code, and knowing the code is what lets a phone read and write it.

   The record: the child's name, word list, settings and the progress answers build on.
   GET /api/sync/CODE  -> 200 { version, data } | 404
   PUT /api/sync/CODE  { version, data } -> 200 { version } when `version` is the one stored (0 creates);
                       otherwise 409 with what is stored, so the phone takes that instead.

   The answer log: one row per tap, only ever added to.
   GET  /api/answers/CODE?after=N -> 200 { answers: [{ n, ...answer }], more } (rows after N, oldest first)
   POST /api/answers/CODE { answers: [...] } -> 200 { ok } (an id already stored is skipped) | 404 with no record */
const CODE = /^[0-9A-HJKMNP-TV-Z]{20}$/; // Crockford base32, 100 bits
const ID = /^[0-9A-Za-z]{10,32}$/;
const RECORD_MAX_CHARS = 256 * 1024;
const POST_MAX_CHARS = 64 * 1024;
const POST_MAX = 100;   // answers per POST
const PAGE = 500;       // answers per GET

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/(sync|answers)\/([^/]+)$/);
    if (!m) return json({ error: "not found" }, 404);
    const code = m[2];
    if (!CODE.test(code)) return json({ error: "bad code" }, 400);
    return m[1] === "sync" ? syncRecord(request, env, code) : syncAnswers(request, env, code, url);
  }
};

async function syncRecord(request, env, code) {
  if (request.method === "GET") {
    const row = await stored(env, code);
    return row ? json(row) : json({ error: "not found" }, 404);
  }
  if (request.method !== "PUT") return json({ error: "method not allowed" }, 405, { Allow: "GET, PUT" });

  const body = await readJson(request, RECORD_MAX_CHARS);
  if (body instanceof Response) return body;
  const base = body && body.version, data = body && body.data;
  // v2 only: the app from before the answer log (v1) would write its whole progress over the record
  if (!Number.isInteger(base) || base < 0 || !data || data.v !== 2) return json({ error: "bad request" }, 400);

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

async function syncAnswers(request, env, code, url) {
  if (request.method === "GET") {
    const after = Number(url.searchParams.get("after") || 0);
    if (!Number.isSafeInteger(after) || after < 0) return json({ error: "bad request" }, 400);
    const { results } = await env.DB.prepare("SELECT n, data FROM answers WHERE code = ?1 AND n > ?2 ORDER BY n LIMIT ?3")
      .bind(code, after, PAGE + 1).all();
    return json({
      answers: results.slice(0, PAGE).map(r => Object.assign(JSON.parse(r.data), { n: r.n })),
      more: results.length > PAGE
    });
  }
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405, { Allow: "GET, POST" });

  const body = await readJson(request, POST_MAX_CHARS);
  if (body instanceof Response) return body;
  const list = body && Array.isArray(body.answers) ? body.answers.map(clean) : [];
  if (!list.length || list.length > POST_MAX || list.includes(null)) return json({ error: "bad request" }, 400);
  if (!await env.DB.prepare("SELECT 1 FROM progress WHERE code = ?1").bind(code).first()) return json({ error: "not found" }, 404);

  await env.DB.batch(list.map(a =>
    env.DB.prepare("INSERT INTO answers (code, id, data) VALUES (?1, ?2, ?3) ON CONFLICT (code, id) DO NOTHING")
      .bind(code, a.id, JSON.stringify(a))));
  return json({ ok: true });
}

/* An answer with only the fields the app uses, or null if it isn't one:
   { id, at, day, by } plus { w, r: "right" | "wrong" }, { w, set: "n" | "l" | "k" } or { undo: id } */
function clean(a) {
  if (!a || typeof a !== "object" || !ID.test(a.id) || !Number.isSafeInteger(a.at) || !Number.isSafeInteger(a.day) ||
      typeof a.by !== "string" || a.by.length > 40) return null;
  const out = { id: a.id, at: a.at, day: a.day, by: a.by };
  if (a.undo !== undefined) return typeof a.undo === "string" && ID.test(a.undo) ? Object.assign(out, { undo: a.undo }) : null;
  if (typeof a.w !== "string" || !a.w || a.w.length > 40) return null;
  out.w = a.w;
  if (a.r === "right" || a.r === "wrong") out.r = a.r;
  else if (a.set === "n" || a.set === "l" || a.set === "k") out.set = a.set;
  else return null;
  return out;
}

async function readJson(request, max) {
  const text = await request.text();
  if (text.length > max) return json({ error: "too large" }, 413);
  try { return JSON.parse(text); } catch (e) { return null; }
}

async function stored(env, code) {
  const row = await env.DB.prepare("SELECT version, data FROM progress WHERE code = ?1").bind(code).first();
  return row && { version: row.version, data: JSON.parse(row.data) };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }
  });
}
