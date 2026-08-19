create table if not exists receipt_counter (
  id text primary key default 'main',
  next_receipt integer not null default 1
);

insert into receipt_counter (id, next_receipt)
values ('main', 1)
on conflict (id) do nothing;

alter table receipt_counter enable row level security;

create policy "app access" on receipt_counter for all using (true) with check (true);

create or replace function issue_receipt_number()
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  update receipt_counter
    set next_receipt = next_receipt + 1
    where id = 'main'
    returning next_receipt - 1 into n;
  return n;
end;
$$;

grant execute on function issue_receipt_number() to anon, authenticated;
