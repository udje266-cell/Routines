-- Tranche 4 : dépenses (et revenus) qui reviennent chaque mois.

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  kind public.planned_kind not null check (kind in ('sortie', 'rentree')),
  amount bigint not null check (amount > 0),
  day smallint not null check (day between 1 and 31),
  start_date date not null,
  end_date date,
  wallet_id uuid not null,
  category text,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete cascade,
  check (end_date is null or end_date >= start_date)
);

-- Exception sur une seule occurrence : autre date, autre montant ou occurrence sautée.
create table public.recurring_overrides (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id uuid not null,
  original_date date not null,
  new_date date,
  new_amount bigint check (new_amount > 0),
  skip boolean not null default false,
  primary key (rule_id, original_date),
  foreign key (user_id, rule_id) references public.recurring_rules (user_id, id) on delete cascade
);

-- Une occurrence réglée = une opération liée ; jamais deux pour la même occurrence.
alter table public.operations
  add column recurring_rule_id uuid,
  add column recurring_original date,
  add foreign key (user_id, recurring_rule_id) references public.recurring_rules (user_id, id) on delete set null (recurring_rule_id),
  add check (recurring_rule_id is null or recurring_original is not null),
  add unique (recurring_rule_id, recurring_original);

do $$
declare t text;
begin
  foreach t in array array['recurring_rules', 'recurring_overrides'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end $$;

-- Règlement d'une occurrence : opération liée, idempotente par clé et unique par occurrence.
create function public.settle_occurrence(
  p_client_key text, p_rule_id uuid, p_original date, p_amount bigint, p_wallet_id uuid, p_op_date date
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rule public.recurring_rules;
  v_op public.operations;
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;
  select * into v_rule from public.recurring_rules where id = p_rule_id and user_id = v_uid for update;
  if not found then raise exception 'dépense mensuelle introuvable' using errcode = 'P0002'; end if;
  if exists (select 1 from public.operations where recurring_rule_id = p_rule_id and recurring_original = p_original) then
    raise exception 'cette échéance est déjà réglée' using errcode = '22023';
  end if;
  if p_amount <= 0 then raise exception 'montant invalide' using errcode = '22023'; end if;
  insert into public.operations (user_id, client_key, kind, wallet_id, amount, op_date, label, category, recurring_rule_id, recurring_original,
                                 income_type)
  values (v_uid, p_client_key, v_rule.kind, p_wallet_id, p_amount, p_op_date, v_rule.label, v_rule.category, p_rule_id, p_original,
          case when v_rule.kind = 'rentree' then 'principal'::public.income_type end)
  returning * into v_op;
  return v_op;
end $$;

-- « Modifier cette occurrence et les suivantes » : la règle s'arrête la veille, une nouvelle prend le relais. Atomique.
create function public.split_recurring_rule(
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
  if p_from_original <= v_rule.start_date then
    update public.recurring_rules set amount = p_amount, day = p_day, label = p_label, wallet_id = p_wallet_id
    where id = v_rule.id returning * into v_new;
    return v_new;
  end if;
  update public.recurring_rules set end_date = p_from_original - 1 where id = v_rule.id;
  insert into public.recurring_rules (label, kind, amount, day, start_date, end_date, wallet_id, category)
  values (p_label, v_rule.kind, p_amount, p_day, p_from_original, v_rule.end_date, p_wallet_id, v_rule.category)
  returning * into v_new;
  return v_new;
end $$;

revoke all on function public.settle_occurrence, public.split_recurring_rule from public, anon;
grant execute on function public.settle_occurrence, public.split_recurring_rule to authenticated;
