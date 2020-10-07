-- !Downs

DROP TABLE IF EXISTS public.session;

-- !Ups

CREATE TABLE public.session (
  id VARCHAR(25),
  user_email VARCHAR(320),
  created TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  active BOOLEAN DEFAULT true NOT NULL,
  last_seeing TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  ip INET NOT NULL
) ;

CREATE UNIQUE INDEX session_id_idx ON public.session
  USING btree (id COLLATE pg_catalog."default");

CREATE INDEX ON session (user_email);

ALTER TABLE public.session
  OWNER TO postgres;
