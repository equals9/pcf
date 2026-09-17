PRAGMA foreign_keys = ON;

CREATE TABLE objects (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (
    type IN ('thought','idea','question','claim','evidence','belief','decision','experiment')
  ),
  content TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_activated_at TEXT,
  importance REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  activation REAL NOT NULL DEFAULT 0.5 CHECK (activation >= 0 AND activation <= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','dormant','archived')),
  provenance TEXT NOT NULL DEFAULT 'user' CHECK (provenance IN ('user','ai_inferred','operator'))
);

CREATE INDEX idx_objects_created_at ON objects(created_at);
CREATE INDEX idx_objects_last_activated ON objects(last_activated_at);

CREATE TABLE house_scores (
  object_id TEXT NOT NULL,
  house INTEGER NOT NULL CHECK (house BETWEEN 1 AND 12),
  score REAL NOT NULL CHECK (score >= 0 AND score <= 1),
  PRIMARY KEY (object_id, house),
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
);

CREATE TABLE concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE object_concepts (
  object_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  PRIMARY KEY (object_id, concept_id),
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,
  FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE
);
CREATE INDEX idx_object_concepts_concept ON object_concepts(concept_id);

CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  rationale TEXT,
  origin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL,
  CHECK (source_id <> target_id),
  FOREIGN KEY (source_id) REFERENCES objects(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES objects(id) ON DELETE CASCADE
);
CREATE INDEX idx_relations_source ON relations(source_id);
CREATE INDEX idx_relations_target ON relations(target_id);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  normalized_claim TEXT NOT NULL,
  subject TEXT,
  predicate TEXT,
  object_text TEXT,
  polarity TEXT NOT NULL DEFAULT 'unknown' CHECK (polarity IN ('positive','negative','unknown')),
  scope TEXT,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
);
CREATE INDEX idx_claims_object ON claims(object_id);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  object_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE SET NULL
);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_type ON events(type);

CREATE TABLE operator_runs (
  id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('mercury_connect','jupiter_expand','saturn_challenge','mars_act')),
  input_context_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('useful','not_useful','opened','saved','acted_on','dismissed')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_feedback_target ON feedback(target_type, target_id);
