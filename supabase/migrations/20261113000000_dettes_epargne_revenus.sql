-- Tranche 2 : revenus typés, dettes et règlements, objectifs d'épargne.

create type public.income_type as enum ('principal', 'petite');
create type public.debt_direction as enum ('je_dois', 'on_me_doit');
create type public.debt_status as enum ('ouverte', 'reglee', 'annulee', 'remise');
create type public.goal_status as enum ('actif', 'atteint', 'abandonne');

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction public.debt_direction not null,
  person text not null check (length(person) between 1 and 60),
  initial_amount bigint not null check (initial_amount > 0),
  due_date date,
  wallet_id uuid,
  certainty public.certainty,
  status public.debt_status not null default 'ouverte',
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete set null (wallet_id),
  -- une créance est incertaine par défaut ; une dette à payer n'a pas de certitude
  check ((direction = 'on_me_doit') = (certainty is not null))
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  target_amount bigint not null check (target_amount > 0),
  target_date date not null,
  pocket_wallet_id uuid not null,
  from_wallet_id uuid,
  planned_day smallint not null default 28 check (planned_day between 1 and 31),
  status public.goal_status not null default 'actif',
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, pocket_wallet_id) references public.wallets (user_id, id) on delete cascade,
  foreign key (user_id, from_wallet_id) references public.wallets (user_id, id) on delete set null (from_wallet_id)
);

alter table public.operations
  add column income_type public.income_type,
  add column debt_id uuid,
  add column goal_id uuid,
  add foreign key (user_id, debt_id) references public.debts (user_id, id) on delete cascade,
  add foreign key (user_id, goal_id) references public.goals (user_id, id) on delete set null (goal_id),
  add check (income_type is null or kind = 'rentree'),
  add check (goal_id is null or kind = 'transfert');

-- Un règlement est relié à une seule opération ; supprimer l'opération supprime le règlement.
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  debt_id uuid not null,
  operation_id uuid not null unique references public.operations (id) on delete cascade,
  amount bigint not null check (amount > 0),
  paid_on date not null,
  created_at timestamptz not null default now(),
  foreign key (user_id, debt_id) references public.debts (user_id, id) on delete cascade
);

create index on public.debt_payments (debt_id);
create index on public.operations (goal_id) where goal_id is not null;

do $$
declare t text;
begin
  foreach t in array array['debts', 'goals', 'debt_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end $$;

-- Les règlements et les mouvements d'objectif passent uniquement par les fonctions atomiques.
revoke insert, update, delete on public.debt_payments from authenticated;

-- record_operation : ajout du type de revenu.
drop function public.record_operation(text, public.planned_kind, uuid, bigint, date, text, text, uuid, bigint, uuid);
create function public.record_operation(
  p_client_key text,
  p_kind public.planned_kind,
  p_wallet_id uuid,
  p_amount bigint,
  p_op_date date,
  p_label text default '',
  p_category text default null,
  p_to_wallet_id uuid default null,
  p_fee bigint default 0,
  p_planned_item_id uuid default null,
  p_income_type public.income_type default null
) returns public.operations
language plpgsql security invoker set search_path = ''
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
    select * into v_planned from public.planned_items where id = p_planned_item_id and user_id = v_uid for update;
    if not found then raise exception 'échéance introuvable' using errcode = 'P0002'; end if;
    if v_planned.status <> 'prevue' then raise exception 'échéance déjà close' using errcode = '22023'; end if;
  end if;

  insert into public.operations (user_id, client_key, kind, wallet_id, to_wallet_id, amount, fee, op_date, label, category, planned_item_id, income_type)
  values (v_uid, p_client_key, p_kind, p_wallet_id, p_to_wallet_id, p_amount, p_fee, p_op_date, coalesce(p_label, ''), p_category, p_planned_item_id,
          case when p_kind = 'rentree' then coalesce(p_income_type, 'principal') end)
  on conflict (user_id, client_key) do nothing
  returning * into v_op;
  if v_op.id is null then
    select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
    return v_op;
  end if;

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

-- Recalcule le statut d'une dette ouverte ou réglée à partir de ses règlements.
create function public.refresh_debt_status(p_debt_id uuid) returns void
language sql security invoker set search_path = ''
as $$
  update public.debts d set status = case
      when coalesce((select sum(amount) from public.debt_payments p where p.debt_id = d.id), 0) >= d.initial_amount then 'reglee'
      else 'ouverte' end::public.debt_status
  where d.id = p_debt_id and d.status in ('ouverte', 'reglee');
$$;
revoke all on function public.refresh_debt_status from public, anon;

-- Remboursement : une seule opération + un règlement, atomiques et idempotents ; refuse un montant supérieur au reste.
create function public.record_debt_payment(
  p_client_key text, p_debt_id uuid, p_amount bigint, p_wallet_id uuid, p_date date
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_debt public.debts;
  v_rest bigint;
  v_op public.operations;
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;

  select * into v_debt from public.debts where id = p_debt_id and user_id = v_uid for update;
  if not found then raise exception 'dette introuvable' using errcode = 'P0002'; end if;
  if v_debt.status <> 'ouverte' then raise exception 'dette close' using errcode = '22023'; end if;
  if not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_uid) then
    raise exception 'portefeuille introuvable' using errcode = 'P0002';
  end if;
  v_rest := v_debt.initial_amount - coalesce((select sum(amount) from public.debt_payments where debt_id = v_debt.id), 0);
  if p_amount <= 0 or p_amount > v_rest then
    raise exception 'paiement supérieur au reste (% F)', v_rest using errcode = '22023';
  end if;

  insert into public.operations (user_id, client_key, kind, wallet_id, amount, op_date, label, debt_id)
  values (v_uid, p_client_key, case v_debt.direction when 'je_dois' then 'sortie' else 'rentree' end::public.planned_kind,
          p_wallet_id, p_amount, p_date,
          case v_debt.direction when 'je_dois' then 'Remboursement à ' else 'Remboursement de ' end || v_debt.person, v_debt.id)
  returning * into v_op;
  insert into public.debt_payments (user_id, debt_id, operation_id, amount, paid_on)
  values (v_uid, v_debt.id, v_op.id, p_amount, p_date);
  perform public.refresh_debt_status(v_debt.id);
  return v_op;
end $$;

-- Annulation d'un règlement : supprime l'opération (et le règlement) puis recalcule la dette.
create function public.cancel_debt_payment(p_payment_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_pay public.debt_payments;
begin
  select * into v_pay from public.debt_payments where id = p_payment_id and user_id = auth.uid();
  if not found then raise exception 'règlement introuvable' using errcode = 'P0002'; end if;
  perform 1 from public.debts where id = v_pay.debt_id for update;
  delete from public.operations where id = v_pay.operation_id;
  perform public.refresh_debt_status(v_pay.debt_id);
end $$;

-- Versement (p_withdraw = false) ou retrait (true) sur un objectif : un transfert atomique et idempotent.
create function public.record_goal_movement(
  p_client_key text, p_goal_id uuid, p_wallet_id uuid, p_amount bigint, p_date date, p_withdraw boolean default false
) returns public.operations
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_goal public.goals;
  v_progress bigint;
  v_op public.operations;
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;
  select * into v_goal from public.goals where id = p_goal_id and user_id = v_uid for update;
  if not found then raise exception 'objectif introuvable' using errcode = 'P0002'; end if;
  if p_wallet_id = v_goal.pocket_wallet_id then raise exception 'choisir un portefeuille du quotidien' using errcode = '22023'; end if;

  if p_withdraw then
    v_progress := coalesce((select sum(case when to_wallet_id = v_goal.pocket_wallet_id then amount else -amount end)
                            from public.operations where goal_id = v_goal.id), 0);
    if p_amount > v_progress then raise exception 'retrait supérieur à l''épargne (% F)', v_progress using errcode = '22023'; end if;
  end if;

  insert into public.operations (user_id, client_key, kind, wallet_id, to_wallet_id, amount, op_date, label, goal_id)
  values (v_uid, p_client_key, 'transfert',
          case when p_withdraw then v_goal.pocket_wallet_id else p_wallet_id end,
          case when p_withdraw then p_wallet_id else v_goal.pocket_wallet_id end,
          p_amount, p_date, case when p_withdraw then 'Retrait : ' else 'Épargne : ' end || v_goal.name, v_goal.id)
  returning * into v_op;
  return v_op;
end $$;

revoke all on function public.record_debt_payment, public.cancel_debt_payment, public.record_goal_movement from public, anon;
grant execute on function public.record_debt_payment, public.cancel_debt_payment, public.record_goal_movement to authenticated;
