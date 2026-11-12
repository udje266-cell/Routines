-- Mes Finances — schéma initial (tranche 1 : portefeuilles, échéances, opérations, intentions d'achat).
-- Montants en francs CFA entiers (bigint), dates civiles (date), identifiants uuid stables.

create type public.wallet_kind as enum ('especes', 'wave', 'orange_money', 'banque', 'epargne');
create type public.planned_kind as enum ('sortie', 'rentree', 'transfert');
create type public.certainty as enum ('attendue', 'incertaine');
create type public.planned_status as enum ('prevue', 'reglee', 'annulee');
create type public.intent_status as enum ('en_pause', 'achete', 'abandonne', 'replanifie');

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  kind public.wallet_kind not null,
  everyday boolean not null default true,
  opening_balance bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.planned_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.planned_kind not null,
  label text not null check (length(label) between 1 and 80),
  amount bigint not null check (amount > 0),
  due_date date not null,
  wallet_id uuid not null,
  to_wallet_id uuid,
  certainty public.certainty,
  funded_by_income_id uuid,
  category text,
  source text check (source in ('facture', 'dette', 'epargne', 'revenu', 'achat')),
  status public.planned_status not null default 'prevue',
  created_at timestamptz not null default now(),
  unique (user_id, id),
  -- propriété des références : le portefeuille appartient au même compte
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete cascade,
  foreign key (user_id, to_wallet_id) references public.wallets (user_id, id) on delete cascade,
  check ((kind = 'transfert') = (to_wallet_id is not null)),
  check ((kind = 'rentree') = (certainty is not null))
);

create table public.operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- clé stable de l'intention d'écriture, fournie par l'appareil : garantit l'idempotence
  client_key text not null check (length(client_key) between 8 and 80),
  kind public.planned_kind not null,
  wallet_id uuid not null,
  to_wallet_id uuid,
  amount bigint not null check (amount > 0),
  fee bigint not null default 0 check (fee >= 0),
  op_date date not null,
  label text not null default '',
  category text,
  planned_item_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, client_key),
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete cascade,
  foreign key (user_id, to_wallet_id) references public.wallets (user_id, id) on delete cascade,
  foreign key (user_id, planned_item_id) references public.planned_items (user_id, id) on delete set null (planned_item_id),
  check ((kind = 'transfert') = (to_wallet_id is not null)),
  check (to_wallet_id is null or to_wallet_id <> wallet_id)
);

create table public.purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_key text not null,
  amount bigint not null check (amount > 0),
  category text not null,
  wallet_id uuid not null,
  planned_date date not null,
  status public.intent_status not null default 'en_pause',
  remind_on date,
  created_at timestamptz not null default now(),
  unique (user_id, client_key),
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete cascade
);

create index on public.planned_items (user_id, due_date) where status = 'prevue';
create index on public.operations (user_id, op_date);

-- RLS : chaque compte ne voit et ne modifie que ses lignes.
do $$
declare t text;
begin
  foreach t in array array['wallets', 'planned_items', 'operations', 'purchase_intents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end $$;

-- Solde réel : solde d'ouverture + opérations confirmées. Les échéances prévues n'y entrent jamais.
create view public.wallet_balances with (security_invoker = true) as
select w.id as wallet_id, w.user_id,
  (w.opening_balance
  + coalesce((select sum(case o.kind when 'rentree' then o.amount else -(o.amount + o.fee) end)
              from public.operations o where o.wallet_id = w.id), 0)
  + coalesce((select sum(o.amount) from public.operations o where o.to_wallet_id = w.id), 0))::bigint
  as balance
from public.wallets w;

-- Écriture atomique et idempotente d'une opération réelle.
-- Rejouer la même client_key renvoie l'opération déjà créée, sans doublon.
create or replace function public.record_operation(
  p_client_key text,
  p_kind public.planned_kind,
  p_wallet_id uuid,
  p_amount bigint,
  p_op_date date,
  p_label text default '',
  p_category text default null,
  p_to_wallet_id uuid default null,
  p_fee bigint default 0,
  p_planned_item_id uuid default null
) returns public.operations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_op public.operations;
  v_planned public.planned_items;
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;

  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;

  if p_planned_item_id is not null then
    select * into v_planned from public.planned_items
      where id = p_planned_item_id and user_id = v_uid for update;
    if not found then raise exception 'échéance introuvable' using errcode = 'P0002'; end if;
    if v_planned.status <> 'prevue' then raise exception 'échéance déjà close' using errcode = '22023'; end if;
  end if;

  insert into public.operations (user_id, client_key, kind, wallet_id, to_wallet_id, amount, fee, op_date, label, category, planned_item_id)
  values (v_uid, p_client_key, p_kind, p_wallet_id, p_to_wallet_id, p_amount, p_fee, p_op_date, coalesce(p_label, ''), p_category, p_planned_item_id)
  on conflict (user_id, client_key) do nothing
  returning * into v_op;

  if v_op.id is null then  -- envoi concurrent avec la même clé
    select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
    return v_op;
  end if;

  -- L'opération confirmée remplace la partie prévue correspondante.
  if p_planned_item_id is not null then
    if p_amount >= v_planned.amount then
      update public.planned_items set status = 'reglee' where id = v_planned.id;
    else
      update public.planned_items set amount = amount - p_amount where id = v_planned.id;
    end if;
  end if;

  return v_op;
end $$;

revoke all on function public.record_operation from public, anon;
grant execute on function public.record_operation to authenticated;
