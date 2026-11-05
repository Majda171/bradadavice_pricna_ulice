-- Bradavice + Příčná ulice v17. Spusť po 01_schema_a_funkce.sql a 02_katalog.sql.
-- Všechny galeony i balení hnojůvek jsou udělovány na serveru, nejvýše jednou na nález.
alter table public.student_shop_progress
  add column if not exists station_completed boolean not null default false;

create table if not exists public.student_treasures (
  student_id uuid not null references auth.users(id) on delete cascade,
  treasure_id text not null,
  claimed_at timestamptz not null default now(),
  primary key(student_id,treasure_id)
);
alter table public.student_treasures enable row level security;
drop policy if exists "own treasures read" on public.student_treasures;
create policy "own treasures read" on public.student_treasures
  for select to authenticated using (student_id=(select auth.uid()));
revoke all on public.student_treasures from anon,authenticated;
grant select on public.student_treasures to authenticated;

create table if not exists public.student_special_rewards (
  student_id uuid not null references auth.users(id) on delete cascade,
  reward_id text not null,
  claimed_at timestamptz not null default now(),
  primary key(student_id,reward_id)
);
alter table public.student_special_rewards enable row level security;
drop policy if exists "own rewards read" on public.student_special_rewards;
create policy "own rewards read" on public.student_special_rewards
  for select to authenticated using (student_id=(select auth.uid()));
revoke all on public.student_special_rewards from anon,authenticated;
grant select on public.student_special_rewards to authenticated;

-- Každý nákup 10 kusů v Příčné automaticky připíše 10 kusů do hradního batohu.
-- Nákup v obchodě se zapisuje do shop_purchases; spotřeba potom do student_inventory.
create or replace function public.v17_sync_dungbomb_purchase()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare increment_count integer;
begin
  if new.product_id <> 'kejkle_hnojovky' then return new; end if;
  increment_count:=new.quantity - case when tg_op='UPDATE' then old.quantity else 0 end;
  if increment_count <= 0 then return new; end if;
  if not exists(select 1 from public.student_inventory
    where student_id=new.student_id and item_id='hnojova-bomba')
    and (select count(*) from public.student_inventory where student_id=new.student_id)>=40 then
    raise exception 'Kouzelný batoh je plný (40 míst). Uvolni místo a potom nakup.';
  end if;
  insert into public.student_inventory(student_id,item_id,quantity)
    values(new.student_id,'hnojova-bomba',increment_count)
    on conflict(student_id,item_id) do update
      set quantity=public.student_inventory.quantity+excluded.quantity;
  return new;
end $$;
drop trigger if exists v17_dungbomb_purchase on public.shop_purchases;
create trigger v17_dungbomb_purchase after insert or update of quantity on public.shop_purchases
  for each row execute function public.v17_sync_dungbomb_purchase();

-- Staré nákupy převést pouze jednou; opakované spuštění SQL zásobu nezduplikuje.
with first_sync as (
  insert into public.student_special_rewards(student_id,reward_id)
    select sp.student_id,'v17_legacy_bombs_import'
      from public.shop_purchases sp where sp.product_id='kejkle_hnojovky'
    on conflict do nothing returning student_id
)
insert into public.student_inventory(student_id,item_id,quantity)
  select sp.student_id,'hnojova-bomba',sp.quantity
    from public.shop_purchases sp join first_sync f on f.student_id=sp.student_id
    where sp.product_id='kejkle_hnojovky'
  on conflict(student_id,item_id) do update
    set quantity=public.student_inventory.quantity+excluded.quantity;

-- Oprava inventáře: větší kapacita a jednotný serverový zápis pro všechny scény.
create or replace function public.v17_collect_item(p_item_id text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); owned integer; slots integer;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  if p_item_id='__check__' then return 'ready'; end if;
  if p_item_id not in ('harp','flute','scarf','bertikovy-fazolky',
    'kouzelna-hulka','letecke-koste','mandragora','lektvar-cerveny',
    'lektvar-ruzovy','sachova-kralovna','lucerna','hnojova-bomba',
    'cokoladova-zabka','obludne-obludarium','stary-pergamen')
    then raise exception 'Neznámý předmět'; end if;
  select quantity into owned from public.student_inventory
    where student_id=uid and item_id=p_item_id for update;
  if owned is not null and p_item_id<>'hnojova-bomba' then return 'already'; end if;
  select count(*) into slots from public.student_inventory where student_id=uid;
  if owned is null and slots>=40 then return 'full'; end if;
  insert into public.student_inventory(student_id,item_id,quantity)
    values(uid,p_item_id,1)
    on conflict(student_id,item_id) do update
      set quantity=public.student_inventory.quantity+1;
  return 'collected';
end $$;

create or replace function public.v17_discard_item(p_item_id text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); owned integer;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  select quantity into owned from public.student_inventory
    where student_id=uid and item_id=p_item_id for update;
  if owned is null then return false; end if;
  if owned>1 and p_item_id='hnojova-bomba' then
    update public.student_inventory set quantity=quantity-1
      where student_id=uid and item_id=p_item_id;
  else
    delete from public.student_inventory where student_id=uid and item_id=p_item_id;
  end if;
  return true;
end $$;

create or replace function public.v17_station_status()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); p public.student_shop_progress%rowtype;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  insert into public.student_shop_progress(student_id) values(uid) on conflict do nothing;
  select * into p from public.student_shop_progress where student_id=uid;
  return jsonb_build_object('schoolReady',p.school_ready,'stationCompleted',p.station_completed);
end $$;

create or replace function public.v17_complete_station()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); ready boolean;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  select school_ready into ready from public.student_shop_progress where student_id=uid for update;
  if ready is distinct from true then raise exception 'Nejdřív dokonči nákupy a kontrolu u Hagrida'; end if;
  update public.student_shop_progress set station_completed=true,updated_at=now() where student_id=uid;
  return public.v17_station_status();
end $$;

create or replace function public.v17_treasure_state()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); ids jsonb;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  select coalesce(jsonb_agg(treasure_id),'[]'::jsonb) into ids
  from public.student_treasures where student_id=uid;
  return jsonb_build_object('claimed',ids);
end $$;

create or replace function public.v17_claim_treasure(p_treasure_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); amount integer:=0; bombs integer:=0; was_added boolean;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  case p_treasure_id
    when 'salazar_chest' then amount:=10;
    when 'chamber_corridor_coins' then amount:=5;
    when 'underground_dungbomb_chest' then bombs:=3;
    else raise exception 'Neznámý poklad';
  end case;
  insert into public.student_wallets(student_id) values(uid) on conflict do nothing;
  perform 1 from public.student_wallets where student_id=uid for update;
  if bombs>0 and not exists(select 1 from public.student_inventory
     where student_id=uid and item_id='hnojova-bomba')
     and (select count(*) from public.student_inventory where student_id=uid)>=40 then
     raise exception 'Nejdřív uvolni místo v kouzelném batohu';
  end if;
  insert into public.student_treasures(student_id,treasure_id) values(uid,p_treasure_id)
  on conflict do nothing returning true into was_added;
  if was_added is not true then return jsonb_build_object('already',true); end if;
  if amount>0 then
    update public.student_wallets set balance=balance+amount,updated_at=now() where student_id=uid;
  end if;
  if bombs>0 then
    insert into public.student_inventory(student_id,item_id,quantity)
      values(uid,'hnojova-bomba',bombs)
      on conflict(student_id,item_id) do update set quantity=public.student_inventory.quantity+excluded.quantity;
  end if;
  return jsonb_build_object('already',false,'galeons',amount,'dungbombs',bombs);
end $$;

-- Výherní zásilka až PO úspěšné sabotáži potvrzené původním úkolem.
create or replace function public.v17_claim_weasley_reward()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); done boolean; was_added boolean;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  select exists(select 1 from public.v446_story_progress
    where student_id=uid and sabotage_at is not null) into done;
  if not done then raise exception 'Odměna přijde teprve po sabotáži Umbridgeové'; end if;
  insert into public.student_wallets(student_id) values(uid) on conflict do nothing;
  perform 1 from public.student_wallets where student_id=uid for update;
  if not exists(select 1 from public.student_inventory
     where student_id=uid and item_id='hnojova-bomba')
     and (select count(*) from public.student_inventory where student_id=uid)>=40 then
     raise exception 'Kouzelný batoh je plný. Uvolni místo pro zásilku';
  end if;
  insert into public.student_special_rewards(student_id,reward_id)
    values(uid,'weasley_sabotage_10') on conflict do nothing returning true into was_added;
  if was_added is not true then return jsonb_build_object('already',true); end if;
  insert into public.shop_purchases(student_id,product_id,quantity)
    values(uid,'kejkle_hnojovky',10)
    on conflict(student_id,product_id) do update
      set quantity=public.shop_purchases.quantity+excluded.quantity,purchased_at=now();
  return jsonb_build_object('already',false,'dungbombs',10);
end $$;

-- Přátelská cena 4 G / 10 kusů se zpřístupní až po splnění úkolu.
create or replace function public.v17_order_weasley_dungbombs()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); completed boolean; funds integer;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  select exists(select 1 from public.v446_story_progress
    where student_id=uid and sabotage_at is not null) into completed;
  if not completed then raise exception 'Nejdřív splň úkol Freda a George'; end if;
  insert into public.student_wallets(student_id) values(uid) on conflict do nothing;
  select balance into funds from public.student_wallets where student_id=uid for update;
  if funds<4 then raise exception 'Na zásilku potřebuješ 4 galeony'; end if;
  if not exists(select 1 from public.student_inventory
    where student_id=uid and item_id='hnojova-bomba')
    and (select count(*) from public.student_inventory where student_id=uid)>=40 then
    raise exception 'Kouzelný batoh je plný';
  end if;
  update public.student_wallets set balance=balance-4,updated_at=now() where student_id=uid;
  insert into public.shop_purchases(student_id,product_id,quantity)
    values(uid,'kejkle_hnojovky',10)
    on conflict(student_id,product_id) do update
      set quantity=public.shop_purchases.quantity+excluded.quantity,purchased_at=now();
  return jsonb_build_object('balance',funds-4,'dungbombs',10);
end $$;

revoke all on function public.v17_sync_dungbomb_purchase(),public.v17_station_status(),
  public.v17_complete_station(),public.v17_treasure_state(),
  public.v17_claim_treasure(text),public.v17_claim_weasley_reward(),
  public.v17_order_weasley_dungbombs(),public.v17_collect_item(text),
  public.v17_discard_item(text) from public,anon;
grant execute on function public.v17_station_status(),public.v17_complete_station(),
  public.v17_treasure_state(),public.v17_claim_treasure(text),
  public.v17_claim_weasley_reward(),public.v17_order_weasley_dungbombs(),
  public.v17_collect_item(text),public.v17_discard_item(text) to authenticated;
