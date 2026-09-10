-- 1. Table storing metadata for each saved photo.
--    The actual image bytes live in Storage; this table just points to them.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  url text not null,
  kind text not null check (kind in ('single', 'strip')),
  created_at timestamptz not null default now()
);

create index if not exists photos_user_id_created_at_idx
  on public.photos (user_id, created_at desc);

-- 2. Row Level Security: every user can only see/insert/delete their own rows.
alter table public.photos enable row level security;

create policy "Users can view their own photos"
  on public.photos for select
  using (auth.uid() = user_id);

create policy "Users can insert their own photos"
  on public.photos for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own photos"
  on public.photos for delete
  using (auth.uid() = user_id);

-- 3. Storage bucket for the actual image files.
--    Public read (so <img> tags and shared links work without signed URLs),
--    but writes/deletes are restricted to the owning user's folder.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "Anyone can view photos in the photos bucket"
  on storage.objects for select
  using (bucket_id = 'photos');

create policy "Users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
