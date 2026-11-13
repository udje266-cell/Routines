begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a41', 'r@test.local');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a41","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values ('10000000-0000-0000-0000-000000000a41', 'Wave', 'wave', 500000);
insert into public.wallets (id, name, kind, everyday) values ('10000000-0000-0000-0000-000000000a42', 'Épargne', 'epargne', false);
insert into public.goals (id, name, target_amount, target_date, pocket_wallet_id) values ('40000000-0000-0000-0000-000000000a41', 'Moto', 100000, '2027-06-30', '10000000-0000-0000-0000-000000000a42');
insert into public.debts (id, direction, person, initial_amount) values ('30000000-0000-0000-0000-000000000a41', 'je_dois', 'Awa', 20000);

-- Dettes : pas depuis l'épargne, pas de suppression directe
select throws_ok($$ select public.record_debt_payment('dp-r-0000001', '30000000-0000-0000-0000-000000000a41', 5000, '10000000-0000-0000-0000-000000000a42', '2026-11-13') $$,
  '22023', null, 'remboursement depuis une poche d''épargne refusé');
select public.record_debt_payment('dp-r-0000002', '30000000-0000-0000-0000-000000000a41', 5000, '10000000-0000-0000-0000-000000000a41', '2026-11-13');
select throws_ok($$ delete from public.debts where id = '30000000-0000-0000-0000-000000000a41' $$, '42501', null, 'une dette ne se supprime pas directement');

-- Opérations libres : quotidien seulement, jamais la poche d'un objectif, même sens que l'échéance
select throws_ok($$ select public.record_operation('op-r-0000001', 'sortie', '10000000-0000-0000-0000-000000000a42', 1000, '2026-11-13') $$,
  '22023', null, 'dépense depuis l''épargne refusée');
select throws_ok($$ select public.record_operation('op-r-0000002', 'transfert', '10000000-0000-0000-0000-000000000a41', 1000, '2026-11-13', '', null, '10000000-0000-0000-0000-000000000a42') $$,
  '22023', null, 'transfert libre vers la poche d''un objectif refusé');
insert into public.planned_items (id, kind, label, amount, due_date, wallet_id, certainty) values ('20000000-0000-0000-0000-000000000a41', 'rentree', 'Prime', 10000, '2026-11-20', '10000000-0000-0000-0000-000000000a41', 'attendue');
select throws_ok($$ select public.record_operation('op-r-0000003', 'sortie', '10000000-0000-0000-0000-000000000a41', 10000, '2026-11-13', '', null, null, 0, '20000000-0000-0000-0000-000000000a41') $$,
  '22023', null, 'une rentrée prévue ne se règle pas par une sortie');

-- Épargne : pas de versement sur un objectif abandonné, retrait possible
select public.record_goal_movement('gm-r-0000001', '40000000-0000-0000-0000-000000000a41', '10000000-0000-0000-0000-000000000a41', 3000, '2026-11-13');
update public.goals set status = 'abandonne' where id = '40000000-0000-0000-0000-000000000a41';
select throws_ok($$ select public.record_goal_movement('gm-r-0000002', '40000000-0000-0000-0000-000000000a41', '10000000-0000-0000-0000-000000000a41', 1000, '2026-11-13') $$,
  '22023', null, 'versement sur un objectif abandonné refusé');
select lives_ok($$ select public.record_goal_movement('gm-r-0000003', '40000000-0000-0000-0000-000000000a41', '10000000-0000-0000-0000-000000000a41', 3000, '2026-11-13', true) $$,
  'retrait d''un objectif abandonné possible');

-- Factures du mois : pas de « suivantes » avant une échéance déjà réglée
insert into public.recurring_rules (id, label, kind, amount, day, start_date, wallet_id) values ('50000000-0000-0000-0000-000000000a41', 'Loyer', 'sortie', 40000, 5, '2026-10-01', '10000000-0000-0000-0000-000000000a41');
select public.settle_occurrence('rr-r-0000001', '50000000-0000-0000-0000-000000000a41', '2026-11-05', 40000, '10000000-0000-0000-0000-000000000a41', '2026-11-05');
select throws_ok($$ select public.split_recurring_rule('50000000-0000-0000-0000-000000000a41', '2026-11-05', 45000, 5::smallint, 'Loyer', '10000000-0000-0000-0000-000000000a41') $$,
  '22023', null, 'coupure avant une échéance réglée refusée');

-- Crédits : cumul des remboursements anticipés, crédit soldé, suppression après déblocage
insert into public.loans (id, label, lender_type, principal, annual_rate, months, first_due_date, wallet_id)
  values ('60000000-0000-0000-0000-000000000a41', 'Prêt', 'banque', 100000, 0.1, 6, '2026-12-05', '10000000-0000-0000-0000-000000000a41');
select public.record_loan_operation('ln-r-0000001', '60000000-0000-0000-0000-000000000a41', 0::smallint, 100000, '10000000-0000-0000-0000-000000000a41', '2026-11-13');
select public.record_loan_operation('ln-r-0000002', '60000000-0000-0000-0000-000000000a41', null, 70000, '10000000-0000-0000-0000-000000000a41', '2026-11-14');
select throws_ok($$ select public.record_loan_operation('ln-r-0000003', '60000000-0000-0000-0000-000000000a41', null, 40000, '10000000-0000-0000-0000-000000000a41', '2026-11-15') $$,
  '22023', null, 'remboursements anticipés plafonnés en cumul');
select throws_ok($$ select public.record_loan_operation('ln-r-0000004', '60000000-0000-0000-0000-000000000a41', 7::smallint, 1000, '10000000-0000-0000-0000-000000000a41', '2026-11-15') $$,
  '22023', null, 'échéance au-delà de la durée refusée');
update public.loans set status = 'solde' where id = '60000000-0000-0000-0000-000000000a41';
select throws_ok($$ select public.record_loan_operation('ln-r-0000005', '60000000-0000-0000-0000-000000000a41', 1::smallint, 1000, '10000000-0000-0000-0000-000000000a41', '2026-12-05') $$,
  '22023', null, 'rien sur un crédit soldé');
select lives_ok($$ delete from public.loans where id = '60000000-0000-0000-0000-000000000a41' $$, 'un crédit débloqué peut être supprimé');
select * from finish();
rollback;
