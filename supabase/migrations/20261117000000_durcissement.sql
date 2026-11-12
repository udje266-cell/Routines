-- Durcissement après revue de sécurité (intégrité au sein d'un même compte, droits, longueurs).

-- Versement / retrait d'objectif : uniquement depuis ou vers le quotidien.
create or replace function public.record_goal_movement(
  p_client_key text, p_goal_id uuid, p_wallet_id uuid, p_amount bigint, p_date date, p_withdraw boolean default false
) returns public.operations
language plpgsql security definer set search_path = ''
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
  if not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_uid and everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
  end if;
  if p_amount <= 0 then raise exception 'montant invalide' using errcode = '22023'; end if;
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

-- Correction d'opération : une dépense ou un revenu reste dans le quotidien.
create or replace function public.update_operation(
  p_id uuid, p_amount bigint, p_op_date date, p_label text, p_category text, p_wallet_id uuid
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare v_op public.operations;
begin
  select * into v_op from public.operations where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'opération introuvable' using errcode = 'P0002'; end if;
  if v_op.debt_id is not null or v_op.goal_id is not null or v_op.planned_item_id is not null or v_op.recurring_rule_id is not null then
    raise exception 'opération liée : corrigez-la depuis sa dette, son objectif ou son échéance' using errcode = '22023';
  end if;
  if p_amount <= 0 then raise exception 'montant invalide' using errcode = '22023'; end if;
  if v_op.kind <> 'transfert' and not exists (select 1 from public.wallets where id = p_wallet_id and user_id = auth.uid() and everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
  end if;
  update public.operations set amount = p_amount, op_date = p_op_date, label = coalesce(p_label, ''), category = p_category, wallet_id = p_wallet_id
  where id = p_id returning * into v_op;
  return v_op;
end $$;

-- Règlement d'une occurrence : la date d'origine doit être une vraie occurrence de la règle.
create or replace function public.settle_occurrence(
  p_client_key text, p_rule_id uuid, p_original date, p_amount bigint, p_wallet_id uuid, p_op_date date
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rule public.recurring_rules;
  v_op public.operations;
  v_expected date;
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;
  select * into v_rule from public.recurring_rules where id = p_rule_id and user_id = v_uid for update;
  if not found then raise exception 'dépense mensuelle introuvable' using errcode = 'P0002'; end if;
  -- jour de la règle ramené au dernier jour du mois
  v_expected := make_date(extract(year from p_original)::int, extract(month from p_original)::int,
                  least(v_rule.day::int, extract(day from (date_trunc('month', p_original) + interval '1 month - 1 day'))::int));
  if p_original <> v_expected or p_original < v_rule.start_date or (v_rule.end_date is not null and p_original > v_rule.end_date) then
    raise exception 'cette date n''est pas une échéance de la dépense mensuelle' using errcode = '22023';
  end if;
  if exists (select 1 from public.operations where recurring_rule_id = p_rule_id and recurring_original = p_original) then
    raise exception 'cette échéance est déjà réglée' using errcode = '22023';
  end if;
  if p_amount <= 0 then raise exception 'montant invalide' using errcode = '22023'; end if;
  if not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_uid and everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
  end if;
  insert into public.operations (user_id, client_key, kind, wallet_id, amount, op_date, label, category, recurring_rule_id, recurring_original, income_type)
  values (v_uid, p_client_key, v_rule.kind, p_wallet_id, p_amount, p_op_date, v_rule.label, v_rule.category, p_rule_id, p_original,
          case when v_rule.kind = 'rentree' then 'principal'::public.income_type end)
  returning * into v_op;
  return v_op;
end $$;

-- Objectifs : la poche est un portefeuille d'épargne ; elle ne change plus une fois des mouvements enregistrés.
create function public.check_goal() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from public.wallets where id = new.pocket_wallet_id and everyday) then
    raise exception 'la poche d''un objectif doit être un portefeuille d''épargne' using errcode = '22023';
  end if;
  if new.from_wallet_id is not null and not exists (select 1 from public.wallets where id = new.from_wallet_id and everyday) then
    raise exception 'les versements partent d''un portefeuille du quotidien' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.pocket_wallet_id <> old.pocket_wallet_id
     and exists (select 1 from public.operations where goal_id = old.id) then
    raise exception 'poche non modifiable : des versements existent' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger goals_check before insert or update on public.goals for each row execute function public.check_goal();

-- Liaison sortie ↔ rentrée : même compte.
alter table public.planned_items
  add foreign key (user_id, funded_by_income_id) references public.planned_items (user_id, id) on delete set null (funded_by_income_id);

-- Fonction interne : pas d'appel direct.
revoke execute on function public.refresh_debt_status from authenticated;

-- Longueurs bornées.
alter table public.operations add check (length(label) <= 80), add check (category is null or length(category) <= 40);
alter table public.purchase_intents add check (length(category) <= 40), add check (length(client_key) between 8 and 80);
alter table public.recurring_rules add check (category is null or length(category) <= 40);
alter table public.planned_items add check (category is null or length(category) <= 40);
