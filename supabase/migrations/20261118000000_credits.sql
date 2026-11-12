-- Tranche Crédit : prêts amortissables, déblocage, échéances et remboursements anticipés.

create type public.lender_type as enum ('banque', 'microfinance', 'autre');
create type public.amortization_method as enum ('annuite', 'capital_constant');
create type public.loan_status as enum ('en_cours', 'solde');

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (length(label) between 1 and 60),
  lender_type public.lender_type not null,
  principal bigint not null check (principal > 0),
  annual_rate numeric(7, 6) not null check (annual_rate >= 0 and annual_rate < 1),
  months smallint not null check (months between 1 and 600),
  first_due_date date not null,
  method public.amortization_method not null default 'annuite',
  fees bigint not null default 0 check (fees >= 0 and fees < principal),
  insurance_monthly bigint not null default 0 check (insurance_monthly >= 0),
  wallet_id uuid not null,
  status public.loan_status not null default 'en_cours',
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete cascade
);

-- 0 = déblocage ; n ≥ 1 = échéance n ; null = remboursement anticipé.
alter table public.operations
  add column loan_id uuid,
  add column loan_installment smallint check (loan_installment >= 0),
  add foreign key (user_id, loan_id) references public.loans (user_id, id) on delete set null (loan_id),
  add check (loan_installment is null or loan_id is not null),
  add unique (loan_id, loan_installment);

alter table public.loans enable row level security;
alter table public.loans force row level security;
create policy loans_owner on public.loans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Le portefeuille d'un crédit est un portefeuille du quotidien.
create function public.check_loan() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.wallets where id = new.wallet_id and everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and (new.principal, new.annual_rate, new.months, new.first_due_date, new.method)
       is distinct from (old.principal, old.annual_rate, old.months, old.first_due_date, old.method)
     and exists (select 1 from public.operations where loan_id = old.id and coalesce(loan_installment, 1) >= 1) then
    raise exception 'conditions du crédit figées après une première échéance payée' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger loans_check before insert or update on public.loans for each row execute function public.check_loan();

-- Opération liée à un crédit : déblocage (0), échéance (n ≥ 1) ou remboursement anticipé (null).
create function public.record_loan_operation(
  p_client_key text, p_loan_id uuid, p_installment smallint, p_amount bigint, p_wallet_id uuid, p_date date
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_loan public.loans;
  v_op public.operations;
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  select * into v_op from public.operations where user_id = v_uid and client_key = p_client_key;
  if found then return v_op; end if;
  select * into v_loan from public.loans where id = p_loan_id and user_id = v_uid for update;
  if not found then raise exception 'crédit introuvable' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_uid and everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
  end if;
  if p_amount <= 0 then raise exception 'montant invalide' using errcode = '22023'; end if;
  if p_installment = 0 and p_amount <> v_loan.principal - v_loan.fees then
    raise exception 'le déblocage correspond au montant emprunté moins les frais (% F)', v_loan.principal - v_loan.fees using errcode = '22023';
  end if;
  if p_installment is null and p_amount > v_loan.principal then
    raise exception 'remboursement anticipé supérieur au montant emprunté' using errcode = '22023';
  end if;
  if p_installment > v_loan.months * 2 then raise exception 'échéance inexistante' using errcode = '22023'; end if;
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

-- Une opération de crédit ne se corrige pas : elle s'annule (suppression) puis se ressaisit.
create or replace function public.update_operation(
  p_id uuid, p_amount bigint, p_op_date date, p_label text, p_category text, p_wallet_id uuid
) returns public.operations
language plpgsql security definer set search_path = ''
as $$
declare v_op public.operations;
begin
  select * into v_op from public.operations where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'opération introuvable' using errcode = 'P0002'; end if;
  if v_op.debt_id is not null or v_op.goal_id is not null or v_op.planned_item_id is not null
     or v_op.recurring_rule_id is not null or v_op.loan_id is not null then
    raise exception 'opération liée : corrigez-la depuis sa dette, son crédit, son objectif ou son échéance' using errcode = '22023';
  end if;
  if p_amount <= 0 then raise exception 'montant invalide' using errcode = '22023'; end if;
  if v_op.kind <> 'transfert' and not exists (select 1 from public.wallets where id = p_wallet_id and user_id = auth.uid() and everyday) then
    raise exception 'choisissez un portefeuille du quotidien' using errcode = '22023';
  end if;
  update public.operations set amount = p_amount, op_date = p_op_date, label = coalesce(p_label, ''), category = p_category, wallet_id = p_wallet_id
  where id = p_id returning * into v_op;
  return v_op;
end $$;
