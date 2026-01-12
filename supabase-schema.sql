-- Plart Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Create filters table
create table if not exists public.filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  params jsonb not null default '{}'::jsonb,
  source text default 'quiz' check (source in ('quiz', 'manual', 'image-match')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for faster user queries
create index if not exists filters_user_id_idx on public.filters(user_id);

-- Enable Row Level Security
alter table public.filters enable row level security;

-- Policy: Users can view their own filters
create policy "Users can view own filters"
  on public.filters for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own filters
create policy "Users can insert own filters"
  on public.filters for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own filters
create policy "Users can update own filters"
  on public.filters for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own filters
create policy "Users can delete own filters"
  on public.filters for delete
  using (auth.uid() = user_id);

-- Function to update the updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger on_filter_updated
  before update on public.filters
  for each row execute procedure public.handle_updated_at();

-- Create storage bucket for reference images (optional)
-- Note: Run this separately or via Supabase dashboard
-- insert into storage.buckets (id, name, public) values ('reference-images', 'reference-images', false);
