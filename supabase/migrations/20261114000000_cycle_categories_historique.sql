-- Tranche 3 : cycle choisi, plafonds par catégorie, intentions datées, historique modifiable, cohérence des dettes.

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cycle_start_day smallint not null default 1 check (cycle_start_day between 1 and 31),
  free_start date,
  free_next_start date,
  small_threshold bigint not null default 10000 check (small_threshold > 0),
  check (free_start is null or free_next_start > free_start)
);

create table public.category_caps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (length(category) between 1 and 40),
  cap bigint not null check (cap >= 0),
  pleasure boolean not null default false,
  unique (user_id, category)
);

alter table public.purchase_intents add column created_on date not null default (now() at time zone 'Africa/Abidjan')::date;

do $$
declare t text;
begin
  foreach t in array array['user_settings', 'category_caps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end $$;

-- Cohérence d'une dette : le montant initial ne descend pas sous le déjà payé ;
-- « ouverte » / « reglee » découlent des règlements (seules « annulee » et « remise » se choisissent).
create function public.check_debt() returns trigger
language plpgsql set search_path = ''
as $$
declare v_paid bigint;
begin
  v_paid := coalesce((select sum(amount) from public.debt_payments where debt_id = new.id), 0);
  if new.initial_amount < v_paid then
    raise exception 'le montant ne peut pas être inférieur au déjà payé (% F)', v_paid using errcode = '22023';
  end if;
  if new.direction <> old.direction then raise exception 'sens de la dette non modifiable' using errcode = '22023'; end if;
  if new.status in ('ouverte', 'reglee') then
    new.status := case when v_paid >= new.initial_amount then 'reglee' else 'ouverte' end;
  end if;
  return new;
end $$;
create trigger debts_check before update on public.debts for each row execute function public.check_debt();

-- Toutes les écritures d'opérations passent par les fonctions : plus d'écriture directe.
revoke insert, update, delete on public.operations from authenticated;
alter function public.record_operation(text, public.planned_kind, uuid, bigint, date, text, text, uuid, bigint, uuid, public.income_type) security definer;
alter function public.record_goal_movement(text, uuid, uuid, bigint, date, boolean) security definer;

-- Correction d'une opération simple (dépense, revenu, transfert sans lien) ; le reste se corrige depuis sa dette ou son objectif.
create function public.update_operation(
  p_id uuid, p_amount bigint, p_op_date date, p_label text, p_category text, p_wallet_id uuid
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare v_op public.operations;
begin
  select * into v_op from public.operations where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'opération introuvable' using errcode = 'P0002'; end if;
  if v_op.debt_id is not null or v_op.goal_id is not null or v_op.planned_item_id is not null then
    raise exception 'opération liée : corrigez-la depuis sa dette, son objectif ou son échéance' using errcode = '22023';
  end if;
  if p_amount <= 0 then raise exception 'montant invalide' using errcode = '22023'; end if;
  update public.operations set amount = p_amount, op_date = p_op_date, label = coalesce(p_label, ''), category = p_category,
    wallet_id = p_wallet_id
  where id = p_id returning * into v_op;
  return v_op;
end $$;

-- Suppression : un remboursement passe par cancel_debt_payment ; un versement d'objectif ne peut rendre l'épargne négative.
create function public.delete_operation(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_op public.operations;
  v_goal public.goals;
  v_left bigint;
begin
  select * into v_op from public.operations where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'opération introuvable' using errcode = 'P0002'; end if;
  if v_op.debt_id is not null then raise exception 'annulez ce remboursement depuis la dette' using errcode = '22023'; end if;
  if v_op.planned_item_id is not null then raise exception 'opération liée à une échéance' using errcode = '22023'; end if;
  if v_op.goal_id is not null then
    select * into v_goal from public.goals where id = v_op.goal_id for update;
    v_left := coalesce((select sum(case when to_wallet_id = v_goal.pocket_wallet_id then amount else -amount end)
                        from public.operations where goal_id = v_goal.id and id <> v_op.id), 0);
    if v_left < 0 then raise exception 'suppression impossible : l''épargne deviendrait négative' using errcode = '22023'; end if;
  end if;
  delete from public.operations where id = p_id;
end $$;

revoke all on function public.update_operation, public.delete_operation from public, anon;
grant execute on function public.update_operation, public.delete_operation to authenticated;
