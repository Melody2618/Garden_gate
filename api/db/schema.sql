-- LaunchGate schema. Run once in the Supabase SQL editor (safe to re-run).
-- The API talks to these tables server-side with the service_role key; the browser never touches Supabase directly.

-- Requests: the server's copy is the only source of truth. `doc` holds the request (form, evaluation, approvals, deployment)
-- except the submitted code, which has its own column so request lists never transfer it.
create table if not exists requests (
  id text primary key,
  requester text not null,
  status text not null,
  doc jsonb not null,
  code text,
  has_code boolean generated always as (coalesce(code, '') <> '') stored,
  version integer not null default 1,  -- optimistic concurrency: an update only applies if it names the version it read
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists requests_requester on requests (requester);
-- Upgrade a database created with the first schema (no-ops on a new one).
alter table requests add column if not exists code text;
alter table requests add column if not exists has_code boolean generated always as (coalesce(code, '') <> '') stored;
alter table requests add column if not exists version integer not null default 1;
update requests set code = doc->>'code', doc = doc - 'code' where doc ? 'code';

-- Audit: append-only. Every state change and every denied action lands here. No secrets, tokens or submitted code are written.
create table if not exists audit (
  seq bigint generated always as identity primary key,
  request_id text,                 -- null for events not tied to a request (e.g. failed login)
  ts timestamptz not null default now(),
  actor text not null,
  action text not null,
  detail jsonb not null default '{}'
);
create index if not exists audit_request on audit (request_id);

-- Enforce append-only in the database itself, so even a leaked service key cannot rewrite history.
create or replace function audit_append_only() returns trigger language plpgsql as $$
begin raise exception 'audit is append-only'; end $$;
drop trigger if exists audit_no_update on audit;
create trigger audit_no_update before update or delete on audit for each row execute function audit_append_only();
drop trigger if exists audit_no_truncate on audit;
create trigger audit_no_truncate before truncate on audit for each statement execute function audit_append_only();

-- RAG vectors (all-MiniLM-L6-v2 = 384 dims). scope = 'policy' or a request id.
create extension if not exists vector;
create table if not exists rag_chunks (
  id bigint generated always as identity primary key,
  scope text not null,
  text text not null,
  meta jsonb not null default '{}',
  embedding vector(384) not null
);
create index if not exists rag_chunks_scope on rag_chunks (scope);
create index if not exists rag_chunks_embedding on rag_chunks using hnsw (embedding vector_cosine_ops);

create or replace function match_chunks(query_embedding vector(384), scopes text[], match_count int)
returns table (id bigint, scope text, text text, meta jsonb, score float)
language sql stable as $$
  select id, scope, text, meta, 1 - (embedding <=> query_embedding) as score
  from rag_chunks where scope = any(scopes)
  order by embedding <=> query_embedding limit match_count;
$$;

-- Least privilege: RLS on with no policies means the public anon key can read or write nothing.
-- Only the server-side service_role key (which bypasses RLS) can reach these tables.
alter table requests enable row level security;
alter table audit enable row level security;
alter table rag_chunks enable row level security;
revoke all on requests, audit, rag_chunks from anon, authenticated;
-- The server's key (service_role, or an sb_secret_ key, which acts as it) gets only what the API uses. Granted explicitly
-- because not every project grants service_role new tables by default. Audit gets no update/delete/truncate at all.
grant select, insert, update on requests to service_role;
grant select, insert on audit to service_role;
grant select, insert, delete on rag_chunks to service_role;
grant usage, select on all sequences in schema public to service_role; -- identity columns (audit.seq, rag_chunks.id)
grant execute on function match_chunks(vector, text[], int) to service_role;
