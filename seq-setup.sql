-- Essay track (Paper 2 · SEQ): one row per member with that member's essay answers and marks.
-- Separate from the MCQ progress table, so it never touches MCQ progress.
create table if not exists public.seq_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  s text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.seq_state enable row level security;
drop policy if exists "seq own select" on public.seq_state;
drop policy if exists "seq own insert" on public.seq_state;
drop policy if exists "seq own update" on public.seq_state;
create policy "seq own select" on public.seq_state for select using (auth.uid() = user_id);
create policy "seq own insert" on public.seq_state for insert with check (auth.uid() = user_id);
create policy "seq own update" on public.seq_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- keep each member under 600 KB of written answers, and stamp the server time
create or replace function public.seq_guard() returns trigger language plpgsql as $$
begin
  if octet_length(new.s) > 600000 then raise exception 'seq limit'; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists seq_guard on public.seq_state;
create trigger seq_guard before insert or update on public.seq_state for each row execute function public.seq_guard();
grant select, insert, update on public.seq_state to authenticated;
