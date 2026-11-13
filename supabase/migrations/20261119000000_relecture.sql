-- Corrections issues de la relecture (sécurité, intégrité, performances).
-- Les fonctions sont redéfinies en entier ; aucune donnée n'est modifiée.

-- 1. Supprimer un crédit ne doit pas échouer : l'opération garde son montant, perd son lien (prêt ET numéro d'échéance).
--    (Postgres n'accepte pas loan_installment dans le « set null » de la clé : on l'efface juste avant.)
create function public.loans_before_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.operations set loan_installment = null where user_id = old.user_id and loan_id = old.id;
  return old;
end $$;
revoke all on function public.loans_before_delete from public, anon, authenticated;
create trigger loans_before_delete before delete on public.loans for each row execute function public.loans_before_delete();

-- 2. Une dette ne se supprime pas (cela effacerait ses remboursements du solde réel) : on l'annule par son statut.
revoke delete on public.debts from authenticated;

-- 3. Index des clés étrangères et des recherches de soldes.
create index if not exists operations_wallet_idx on public.operations (user_id, wallet_id);
create index if not exists operations_to_wallet_idx on public.operations (user_id, to_wallet_id) where to_wallet_id is not null;
create index if not exists operations_debt_idx on public.operations (user_id, debt_id) where debt_id is not null;
create index if not exists operations_goal_idx on public.operations (user_id, goal_id) where goal_id is not null;
create index if not exists operations_planned_idx on public.operations (user_id, planned_item_id) where planned_item_id is not null;
create index if not exists operations_rule_idx on public.operations (user_id, recurring_rule_id) where recurring_rule_id is not null;
create index if not exists operations_loan_idx on public.operations (user_id, loan_id) where loan_id is not null;
create index if not exists planned_items_wallet_idx on public.planned_items (user_id, wallet_id);
create index if not exists planned_items_to_wallet_idx on public.planned_items (user_id, to_wallet_id) where to_wallet_id is not null;
create index if not exists planned_items_funded_idx on public.planned_items (user_id, funded_by_income_id) where funded_by_income_id is not null;
create index if not exists debts_wallet_idx on public.debts (user_id, wallet_id) where wallet_id is not null;
create index if not exists debt_payments_debt_idx on public.debt_payments (user_id, debt_id);
create index if not exists goals_pocket_idx on public.goals (user_id, pocket_wallet_id);
create index if not exists goals_from_idx on public.goals (user_id, from_wallet_id) where from_wallet_id is not null;
create index if not exists purchase_intents_wallet_idx on public.purchase_intents (user_id, wallet_id);
create index if not exists recurring_rules_wallet_idx on public.recurring_rules (user_id, wallet_id);
create index if not exists loans_wallet_idx on public.loans (user_id, wallet_id);

-- Poche d'un objectif actif (l'argent n'en sort ou n'y entre que par record_goal_movement).
create function public.is_goal_pocket(p_uid uuid, p_wallet_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.goals where user_id = p_uid and pocket_wallet_id = p_wallet_id and status = 'actif') $$;
revoke all on function public.is_goal_pocket from public, anon, authenticated;

-- 4. Opération libre : dépense et revenu depuis le quotidien ; jamais vers ou depuis la poche d'un objectif ;
--    une échéance prévue se règle avec une opération de même sens.
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
  p_planned_item_id uuid default null,
  p_income_type public.income_type default null
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_op public.operations;
  v_planned public.planned_items;
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;

  -- (un portefeuille d'un autre compte est refusé plus bas par la clé étrangère)
  if p_kind in ('sortie', 'rentree') and exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_uid and not everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
  end if;
  if p_kind = 'transfert' and (public.is_goal_pocket(v_uid, p_wallet_id) or public.is_goal_pocket(v_uid, p_to_wallet_id)) then
    raise exception 'pour l''épargne d''un objectif, utilisez « Ajouter un versement » ou « Retirer »' using errcode = '22023';
  end if;

  if p_planned_item_id is not null then
    select * into v_planned from public.planned_items where id = p_planned_item_id and user_id = v_uid for update;
    if not found then raise exception 'échéance introuvable' using errcode = 'P0002'; end if;
    if v_planned.status <> 'prevue' then raise exception 'échéance déjà close' using errcode = '22023'; end if;
    if v_planned.kind <> p_kind then raise exception 'l''opération ne correspond pas à l''échéance' using errcode = '22023'; end if;
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

-- 5. Remboursement de dette : depuis le quotidien seulement ; réessai simultané sans erreur.
create or replace function public.record_debt_payment(
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
  select * into v_debt from public.debts where id = p_debt_id and user_id = v_uid for update;
  if not found then raise exception 'dette introuvable' using errcode = 'P0002'; end if;
  -- relu après le verrou : un second envoi simultané retrouve l'opération du premier
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;
  if v_debt.status <> 'ouverte' then raise exception 'dette close' using errcode = '22023'; end if;
  if not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_uid) then
    raise exception 'portefeuille introuvable' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_uid and everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
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
revoke all on function public.record_debt_payment from public, anon;
grant execute on function public.record_debt_payment to authenticated;

-- 6. Épargne : pas de versement sur un objectif atteint ou abandonné (le retrait reste possible) ; réessai simultané sans erreur.
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
  select * into v_goal from public.goals where id = p_goal_id and user_id = v_uid for update;
  if not found then raise exception 'objectif introuvable' using errcode = 'P0002'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;
  if not p_withdraw and v_goal.status <> 'actif' then
    raise exception 'cet objectif n''est plus actif' using errcode = '22023';
  end if;
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
revoke all on function public.record_goal_movement from public, anon;
grant execute on function public.record_goal_movement to authenticated;

-- 7. Facture du mois réglée : réessai simultané sans erreur.
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
  select * into v_rule from public.recurring_rules where id = p_rule_id and user_id = v_uid for update;
  if not found then raise exception 'dépense mensuelle introuvable' using errcode = 'P0002'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;
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
revoke all on function public.settle_occurrence from public, anon;
grant execute on function public.settle_occurrence to authenticated;

-- 8. « Les suivantes » d'une facture du mois : refusé avant une échéance déjà réglée (sinon elle redeviendrait à payer),
--    et les changements ponctuels (« ce mois-ci ») suivent la nouvelle règle.
create or replace function public.split_recurring_rule(
  p_rule_id uuid, p_from_original date, p_amount bigint, p_day smallint, p_label text, p_wallet_id uuid
) returns public.recurring_rules
language plpgsql security invoker set search_path = ''
as $$
declare
  v_rule public.recurring_rules;
  v_new public.recurring_rules;
begin
  select * into v_rule from public.recurring_rules where id = p_rule_id and user_id = auth.uid() for update;
  if not found then raise exception 'dépense mensuelle introuvable' using errcode = 'P0002'; end if;
  if exists (select 1 from public.operations where recurring_rule_id = p_rule_id and recurring_original >= p_from_original) then
    raise exception 'une échéance à partir de cette date est déjà réglée : modifiez à partir de la suivante' using errcode = '22023';
  end if;
  if p_from_original <= v_rule.start_date then
    update public.recurring_rules set amount = p_amount, day = p_day, label = p_label, wallet_id = p_wallet_id
    where id = v_rule.id returning * into v_new;
    return v_new;
  end if;
  update public.recurring_rules set end_date = p_from_original - 1 where id = v_rule.id;
  insert into public.recurring_rules (label, kind, amount, day, start_date, end_date, wallet_id, category)
  values (p_label, v_rule.kind, p_amount, p_day, p_from_original, v_rule.end_date, p_wallet_id, v_rule.category)
  returning * into v_new;
  update public.recurring_overrides set rule_id = v_new.id where rule_id = v_rule.id and original_date >= p_from_original;
  return v_new;
end $$;
revoke all on function public.split_recurring_rule from public, anon;
grant execute on function public.split_recurring_rule to authenticated;

-- 9. Crédit : rien sur un crédit soldé ; échéance ≤ durée ; remboursements anticipés plafonnés en cumul au montant emprunté ;
--    réessai simultané sans erreur.
create or replace function public.record_loan_operation(
  p_client_key text, p_loan_id uuid, p_installment smallint, p_amount bigint, p_wallet_id uuid, p_date date
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_loan public.loans;
  v_op public.operations;
  v_early bigint;
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  select * into v_loan from public.loans where id = p_loan_id and user_id = v_uid for update;
  if not found then raise exception 'crédit introuvable' using errcode = 'P0002'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;
  if v_loan.status = 'solde' then raise exception 'ce crédit est déjà soldé' using errcode = '22023'; end if;
  if not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_uid and everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
  end if;
  if p_amount <= 0 then raise exception 'montant invalide' using errcode = '22023'; end if;
  if p_installment = 0 and p_amount <> v_loan.principal - v_loan.fees then
    raise exception 'le déblocage correspond au montant emprunté moins les frais (% F)', v_loan.principal - v_loan.fees using errcode = '22023';
  end if;
  if p_installment is null then
    v_early := coalesce((select sum(amount) from public.operations where loan_id = p_loan_id and loan_installment is null), 0);
    if v_early + p_amount > v_loan.principal then
      raise exception 'remboursement anticipé supérieur au reste emprunté (% F)', v_loan.principal - v_early using errcode = '22023';
    end if;
  end if;
  if p_installment > v_loan.months then raise exception 'échéance inexistante' using errcode = '22023'; end if;
  if p_installment is not null and exists (select 1 from public.operations where loan_id = p_loan_id and loan_installment = p_installment) then
    raise exception 'cette échéance est déjà enregistrée' using errcode = '22023';
  end if;

  insert into public.operations (user_id, client_key, kind, wallet_id, amount, op_date, label, category, loan_id, loan_installment)
  values (v_uid, p_client_key, case when p_installment = 0 then 'rentree' else 'sortie' end::public.planned_kind, p_wallet_id, p_amount, p_date,
          case when p_installment = 0 then 'Déblocage : ' when p_installment is null then 'Remboursement anticipé : ' else 'Échéance : ' end || v_loan.label,
          'Crédit', p_loan_id, p_installment)
  returning * into v_op;
  return v_op;
end $$;
revoke all on function public.record_loan_operation from public, anon;
grant execute on function public.record_loan_operation to authenticated;
