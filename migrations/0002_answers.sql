-- Every tap a grown-up makes in a quiz: right, wrong, an undo, or a word's status set by hand. Rows are
-- only ever added, so phones that quizzed offline add theirs later and nothing is overwritten. `n` is the
-- order rows arrived in, which phones use as a cursor to fetch only what's new; `id` comes from the
-- phone, so sending the same answer twice stores it once.
CREATE TABLE answers (
  n INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  UNIQUE (code, id)
);
CREATE INDEX answers_by_code ON answers (code, n);
