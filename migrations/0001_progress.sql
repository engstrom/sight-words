-- One family's progress, keyed by its sync code. `version` goes up by one on every write, and a
-- write names the version it was made on top of, so a device that's behind can't overwrite newer progress.
CREATE TABLE progress (
  code TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
