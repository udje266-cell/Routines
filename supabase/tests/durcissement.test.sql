begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a21', 'i@test.local'),
  ('00000000-0000-0000-0000-000000000b21', 'j@test.local');
set local role authenticated;

-- Données de B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000b21","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values ('10000000-0000-0000-0000-000000000b21', 'Wave B', 'wave', 10000);
insert into public.wallets (id, name, kind, everyday) values ('10000000-0000-0000-0000-000000000b22', 'Épargne B', 'epargne', false);
insert into public.debts (id, direction, person, initial_amount) values ('30000000-0000-0000-0000-000000000b21', 'je_dois', 'X', 1000);
insert into public.goals (id, name, target_amount, target_date, pocket_wallet_id) values ('40000000-0000-0000-0000-000000000b21', 'G', 1000, '2027-01-01', '10000000-0000-0000-0000-000000000b22');
insert into public.recurring_rules (id, label, kind, amount, day, start_date, wallet_id) values ('50000000-0000-0000-0000-000000000b21', 'Loyer B', 'sortie', 1000, 5, '2026-11-01', '10000000-0000-0000-0000-000000000b21');

-- Compte A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a21","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values ('10000000-0000-0000-0000-000000000a21', 'Wave', 'wave', 50000);
insert into public.wallets (id, name, kind, everyday) values
  ('10000000-0000-0000-0000-000000000a22', 'Épargne', 'epargne', false),
  ('10000000-0000-0000-0000-000000000a23', 'Épargne 2', 'epargne', false);
insert into public.goals (id, name, target_amount, target_date, pocket_wallet_id) values ('40000000-0000-0000-0000-000000000a21', 'Moto', 100000, '2027-06-30', '10000000-0000-0000-0000-000000000a22');
insert into public.recurring_rules (id, label, kind, amount, day, start_date, wallet_id) values ('50000000-0000-0000-0000-000000000a21', 'Loyer', 'sortie', 25000, 31, '2026-11-01', '10000000-0000-0000-0000-000000000a21');

-- Intégrité dans un même compte
select throws_ok($$ select public.settle_occurrence('occ-a-000001', '50000000-0000-0000-0000-000000000a21', '2026-11-15', 25000, '10000000-0000-0000-0000-000000000a21', '2026-11-15') $$,
  '22023', null, 'une date qui n''est pas une occurrence est refusée');
select lives_ok($$ select public.settle_occurrence('occ-a-000002', '50000000-0000-0000-0000-000000000a21', '2026-11-30', 25000, '10000000-0000-0000-0000-000000000a21', '2026-11-12') $$,
  'le 30 novembre est bien l''occurrence du 31');
select throws_ok($$ select public.settle_occurrence('occ-a-000003', '50000000-0000-0000-0000-000000000a21', '2026-12-31', 25000, '10000000-0000-0000-0000-000000000a22', '2026-11-12') $$,
  '22023', null, 'régler depuis une poche d''épargne est refusé');
select throws_ok($$ select public.record_goal_movement('obj-a-000001', '40000000-0000-0000-0000-000000000a21', '10000000-0000-0000-0000-000000000a23', 1000, '2026-11-12') $$,
  '22023', null, 'verser depuis une autre poche d''épargne est refusé');
select throws_ok($$ insert into public.goals (name, target_amount, target_date, pocket_wallet_id) values ('X', 1000, '2027-01-01', '10000000-0000-0000-0000-000000000a21') $$,
  '22023', null, 'une poche d''objectif ne peut pas être un portefeuille du quotidien');
select public.record_goal_movement('obj-a-000002', '40000000-0000-0000-0000-000000000a21', '10000000-0000-0000-0000-000000000a21', 1000, '2026-11-12');
select throws_ok($$ update public.goals set pocket_wallet_id = '10000000-0000-0000-0000-000000000a23' $$,
  '22023', null, 'la poche ne change plus après un versement');
select public.record_operation('dep-a-000001', 'sortie', '10000000-0000-0000-0000-000000000a21', 2000, '2026-11-12', 'Garba');
select throws_ok($$ select public.update_operation((select id from public.operations where client_key = 'dep-a-000001'), 2000, '2026-11-12', 'Garba', null, '10000000-0000-0000-0000-000000000a22') $$,
  '22023', null, 'une dépense ne peut pas être déplacée vers une poche d''épargne');
select throws_ok($$ select public.refresh_debt_status('30000000-0000-0000-0000-000000000b21') $$, '42501', null, 'fonction interne non appelable');

-- A tente d'utiliser les références de B
select throws_ok($$ select public.record_operation('x-a-0000001', 'sortie', '10000000-0000-0000-0000-000000000b21', 1, '2026-11-12') $$, '23503', null, 'portefeuille de B refusé');
select throws_ok($$ select public.record_debt_payment('x-a-0000002', '30000000-0000-0000-0000-000000000b21', 1, '10000000-0000-0000-0000-000000000a21', '2026-11-12') $$, 'P0002', null, 'dette de B refusée');
select throws_ok($$ select public.record_goal_movement('x-a-0000003', '40000000-0000-0000-0000-000000000b21', '10000000-0000-0000-0000-000000000a21', 1, '2026-11-12') $$, 'P0002', null, 'objectif de B refusé');
select throws_ok($$ insert into public.recurring_overrides (rule_id, original_date, skip) values ('50000000-0000-0000-0000-000000000b21', '2026-12-05', true) $$, '23503', null, 'exception sur la règle de B refusée');
select is((select count(*)::int from public.wallet_balances), 3, 'wallet_balances : A ne voit que ses portefeuilles');

-- Rôle anonyme : rien de lisible
set local role anon;
select is((select count(*)::int from public.wallets) + (select count(*)::int from public.operations) + (select count(*)::int from public.debts)
        + (select count(*)::int from public.goals) + (select count(*)::int from public.recurring_rules), 0, 'anonyme : aucune ligne lisible');
select * from finish();
rollback;
