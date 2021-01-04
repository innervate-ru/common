-- !Downs

DROP TABLE IF EXISTS public.id_doctype;

-- !Ups

DO $$ BEGIN IF NOT EXISTS (SELECT * FROM pg_proc WHERE proname = 'moddatetime') THEN CREATE EXTENSION moddatetime; END IF; END; $$;

CREATE TABLE public.id_doctype (
  id CHAR(21) NOT NULL,
  type VARCHAR(500) NOT NULL
);

CREATE UNIQUE INDEX ON public.id_doctype (id);
