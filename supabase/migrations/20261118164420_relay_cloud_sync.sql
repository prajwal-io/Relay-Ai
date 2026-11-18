create table if not exists public.relay_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_key text not null,
  name text not null check (char_length(name) between 1 and 120),
  repository_url text,
  updated_at timestamptz not null default now(),
  unique (owner_id, project_key)
);

alter table public.relay_projects enable row level security;
create policy "Users manage their own Relay projects"
  on public.relay_projects for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create table if not exists public.relay_memory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.relay_projects(id) on delete cascade,
  item_key text not null,
  kind text not null check (kind in ('task', 'decision', 'issue', 'file', 'note')),
  content text not null check (char_length(content) between 1 and 8000),
  status text,
  source text not null,
  updated_at timestamptz not null default now(),
  unique (project_id, item_key)
);

alter table public.relay_memory_items enable row level security;
create policy "Users manage their own Relay memory"
  on public.relay_memory_items for all to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.relay_projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.relay_projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.relay_projects to authenticated;
grant select, insert, update, delete on public.relay_memory_items to authenticated;
