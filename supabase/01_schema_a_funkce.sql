-- Příčná ulice v16 / Bradavice. Spusť JEDNOU v Supabase SQL Editoru.
-- Ceny a zůstatky jsou řízené databází, nikoliv hodnotami z prohlížeče.

create table if not exists public.shops (
  id text primary key,
  title text not null
);
create table if not exists public.shop_products (
  id text primary key,
  shop_id text not null references public.shops(id),
  title text not null,
  category text not null,
  price integer not null check (price >= 0),
  pack_quantity integer not null default 1 check (pack_quantity > 0),
  is_unique boolean not null default false,
  is_required boolean not null default false,
  image_path text,
  active boolean not null default true
);
create table if not exists public.student_wallets (
  student_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  grant_claimed boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.shop_purchases (
  student_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.shop_products(id),
  quantity integer not null check (quantity > 0),
  purchased_at timestamptz not null default now(),
  primary key(student_id, product_id)
);
create table if not exists public.student_shop_progress (
  student_id uuid primary key references auth.users(id) on delete cascade,
  pet_id text references public.shop_products(id),
  pet_name text not null default '',
  wand_id text references public.shop_products(id),
  school_ready boolean not null default false,
  last_scene text not null default 'kotel_vchod',
  updated_at timestamptz not null default now()
);
create table if not exists public.student_raddle_progress (
  student_id uuid primary key references auth.users(id) on delete cascade,
  phase integer not null default 0 check (phase between 0 and 6),
  updated_at timestamptz not null default now()
);

alter table public.shops enable row level security;
alter table public.shop_products enable row level security;
alter table public.student_wallets enable row level security;
alter table public.shop_purchases enable row level security;
alter table public.student_shop_progress enable row level security;
alter table public.student_raddle_progress enable row level security;

drop policy if exists "shop list for students" on public.shops;
create policy "shop list for students" on public.shops for select to authenticated using (true);
drop policy if exists "product list for students" on public.shop_products;
create policy "product list for students" on public.shop_products for select to authenticated using (active);
drop policy if exists "own wallet read" on public.student_wallets;
create policy "own wallet read" on public.student_wallets for select to authenticated using (student_id = (select auth.uid()));
drop policy if exists "own purchases read" on public.shop_purchases;
create policy "own purchases read" on public.shop_purchases for select to authenticated using (student_id = (select auth.uid()));
drop policy if exists "own shop progress read" on public.student_shop_progress;
create policy "own shop progress read" on public.student_shop_progress for select to authenticated using (student_id = (select auth.uid()));
drop policy if exists "own raddle progress read" on public.student_raddle_progress;
create policy "own raddle progress read" on public.student_raddle_progress for select to authenticated using (student_id = (select auth.uid()));

revoke all on public.student_wallets, public.shop_purchases, public.student_shop_progress, public.student_raddle_progress from anon, authenticated;
grant select on public.student_wallets, public.shop_purchases, public.student_shop_progress, public.student_raddle_progress to authenticated;
grant select on public.shops, public.shop_products to authenticated;

create or replace function public.v16_shop_state()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); wallet public.student_wallets%rowtype; progress public.student_shop_progress%rowtype; purchases jsonb;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  insert into public.student_wallets(student_id) values(uid) on conflict do nothing;
  insert into public.student_shop_progress(student_id) values(uid) on conflict do nothing;
  select * into wallet from public.student_wallets where student_id=uid;
  select * into progress from public.student_shop_progress where student_id=uid;
  select coalesce(jsonb_object_agg(product_id, quantity), '{}'::jsonb) into purchases
  from public.shop_purchases where student_id=uid;
  return jsonb_build_object('balance',wallet.balance,'grantClaimed',wallet.grant_claimed,'purchases',purchases,
    'petId',progress.pet_id,'petName',progress.pet_name,'wandId',progress.wand_id,
    'schoolReady',progress.school_ready,'lastScene',progress.last_scene);
end $$;

create or replace function public.v16_claim_school_grant()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); wallet public.student_wallets%rowtype;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  insert into public.student_wallets(student_id) values(uid) on conflict do nothing;
  select * into wallet from public.student_wallets where student_id=uid for update;
  if wallet.grant_claimed then raise exception 'Školní příspěvek už byl vyzvednut'; end if;
  update public.student_wallets set balance=balance+500, grant_claimed=true, updated_at=now() where student_id=uid;
  return public.v16_shop_state();
end $$;

create or replace function public.v16_purchase_product(p_product_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); prod public.shop_products%rowtype; wallet public.student_wallets%rowtype; already integer; existing_category integer;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  select * into prod from public.shop_products where id=p_product_id and active=true;
  if not found then raise exception 'Položka není v katalogu'; end if;
  insert into public.student_wallets(student_id) values(uid) on conflict do nothing;
  insert into public.student_shop_progress(student_id) values(uid) on conflict do nothing;
  select * into wallet from public.student_wallets where student_id=uid for update;
  if not wallet.grant_claimed then raise exception 'Nejdřív si vyzvedni příspěvek v Gringottově bance'; end if;
  if wallet.balance < prod.price then raise exception 'Nemáš dost galeonů'; end if;
  select quantity into already from public.shop_purchases where student_id=uid and product_id=prod.id;
  if prod.is_unique and coalesce(already,0)>0 then raise exception 'Tuto položku už máš'; end if;
  if prod.category in ('hulka','mazlicek') then
    select count(*) into existing_category from public.shop_purchases sp join public.shop_products p on p.id=sp.product_id
       where sp.student_id=uid and p.category=prod.category;
    if existing_category>0 then raise exception 'V této kategorii můžeš mít jen jeden výběr'; end if;
  end if;
  update public.student_wallets set balance=balance-prod.price,updated_at=now() where student_id=uid;
  insert into public.shop_purchases(student_id,product_id,quantity) values(uid,prod.id,prod.pack_quantity)
  on conflict(student_id,product_id) do update set quantity=public.shop_purchases.quantity+excluded.quantity,purchased_at=now();
  if prod.category='hulka' then update public.student_shop_progress set wand_id=prod.id,updated_at=now() where student_id=uid; end if;
  if prod.category='mazlicek' then update public.student_shop_progress set pet_id=prod.id,pet_name='',updated_at=now() where student_id=uid; end if;
  return public.v16_shop_state();
end $$;

create or replace function public.v16_set_pet_name(p_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); cleaned text := btrim(coalesce(p_name,''));
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  if length(cleaned) not between 1 and 35 then raise exception 'Jméno musí mít 1 až 35 znaků'; end if;
  update public.student_shop_progress set pet_name=cleaned,updated_at=now() where student_id=uid and pet_id is not null;
  if not found then raise exception 'Nejdřív si kup mazlíčka'; end if;
  return public.v16_shop_state();
end $$;

create or replace function public.v16_save_shop_progress(p_scene text default null,p_school_ready boolean default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); missing_required integer; has_wand boolean;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  if p_scene is not null and (length(p_scene)>80 or p_scene !~ '^[a-z0-9_]+$') then raise exception 'Neplatná lokace'; end if;
  if p_school_ready is true then
    select count(*) into missing_required from public.shop_products p
      where p.is_required=true and p.active=true and not exists (
        select 1 from public.shop_purchases sp where sp.student_id=uid and sp.product_id=p.id);
    select exists(select 1 from public.shop_purchases sp join public.shop_products p on sp.product_id=p.id
      where sp.student_id=uid and p.category='hulka') into has_wand;
    if missing_required>0 or not has_wand then raise exception 'Nejdřív musíš dokončit všechny povinné nákupy'; end if;
  end if;
  insert into public.student_shop_progress(student_id) values(uid) on conflict do nothing;
  update public.student_shop_progress set last_scene=coalesce(p_scene,last_scene),
      school_ready=case when p_school_ready is true then true else school_ready end,updated_at=now() where student_id=uid;
  return public.v16_shop_state();
end $$;

create or replace function public.v16_advance_raddle_phase(p_phase integer)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); current_phase integer;
begin
  if uid is null then raise exception 'Vyžaduje se přihlášení'; end if;
  if p_phase not between 0 and 6 then raise exception 'Neplatná fáze'; end if;
  insert into public.student_raddle_progress(student_id,phase) values(uid,p_phase)
    on conflict(student_id) do update set phase=greatest(public.student_raddle_progress.phase,excluded.phase),updated_at=now();
  select phase into current_phase from public.student_raddle_progress where student_id=uid;
  return current_phase;
end $$;

revoke all on function public.v16_shop_state(), public.v16_claim_school_grant(),
 public.v16_purchase_product(text),public.v16_set_pet_name(text),
 public.v16_save_shop_progress(text,boolean), public.v16_advance_raddle_phase(integer) from public, anon;
grant execute on function public.v16_shop_state(), public.v16_claim_school_grant(),
 public.v16_purchase_product(text),public.v16_set_pet_name(text),
 public.v16_save_shop_progress(text,boolean), public.v16_advance_raddle_phase(integer) to authenticated;
