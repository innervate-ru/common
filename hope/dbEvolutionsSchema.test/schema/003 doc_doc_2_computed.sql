-- NOTE: Do not edit this file manually.  It's generated by the build task

-- !Table

{
  "name": "doc_doc_2_computed",
  "fields": {
    "id": {
      "type": "nanoid"
    },
    "rev": {
      "type": "integer",
      "init": 0
    },
    "options": {
      "type": "json"
    },
    "created": {
      "type": "timestamp"
    },
    "modified": {
      "type": "timestamp"
    },
    "deleted": {
      "type": "boolean",
      "init": false
    }
  },
  "indecies": {
    "id": {
      "unique": true
    },
    "options": {
      "gin": true
    },
    "created": {},
    "modified": {}
  }
}

-- !Downs

DROP TABLE IF EXISTS public.doc_doc_2_computed;

-- !Ups

DO $$ BEGIN IF NOT EXISTS (SELECT * FROM pg_proc WHERE proname = 'moddatetime') THEN CREATE EXTENSION moddatetime; END IF; END; $$;

CREATE TABLE public.doc_doc_2_computed (
  id CHAR(21) NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0,
  options JSONB NOT NULL,
  created TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  modified TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE TRIGGER mdt_moddatetime BEFORE UPDATE ON public.doc_doc_2_computed FOR EACH ROW EXECUTE PROCEDURE moddatetime (modified);

CREATE UNIQUE INDEX ON public.doc_doc_2_computed (id);

CREATE INDEX ON public.doc_doc_2_computed USING GIN(options);

CREATE INDEX ON public.doc_doc_2_computed (created);

CREATE INDEX ON public.doc_doc_2_computed (modified);