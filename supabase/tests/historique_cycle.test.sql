begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.local');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values ('10000000-0000-0000-0000-0000000000c1', 'Wave', 'wave', 50000);
insert into public.wallets (id, name, kind, everyday) values ('10000000-0000-0000-0000-0000000000c2', 'Épargne', 'epargne', false);

-- Écriture directe interdite
select throws_ok($$ insert into public.operations (client_key, kind, wallet_id, amount, op_date) values ('direct-00001', 'sortie', '10000000-0000-0000-0000-0000000000c1', 1000, '2026-11-12') $$,
  '42501', null, 'insertion directe d''opération interdite');

-- Historique modifiable
select public.record_operation('depense-00001', 'sortie', '10000000-0000-0000-0000-0000000000c1', 3000, '2026-11-12', 'Garba', 'Alimentation');
select public.update_operation((select id from public.operations), 3500, '2026-11-11', 'Garba', 'Alimentation', '10000000-0000-0000-0000-0000000000c1');
select is((select balance::int from public.wallet_balances where wallet_id = '10000000-0000-0000-0000-0000000000c1'), 46500, 'correction : solde recalculé');
select public.delete_operation((select id from public.operations));
select is((select count(*)::int from public.operations), 0, 'suppression d''une dépense');

-- Dette : cohérence
insert into public.debts (id, direction, person, initial_amount) values ('30000000-0000-0000-0000-0000000000c1', 'je_dois', 'Koffi', 20000);
select public.record_debt_payment('dette-c-00001', '30000000-0000-0000-0000-0000000000c1', 5000, '10000000-0000-0000-0000-0000000000c1', '2026-11-12');
select throws_ok($$ update public.debts set initial_amount = 4000 $$, '22023', null, 'montant initial sous le déjà payé refusé');
update public.debts set status = 'reglee';
select is((select status::text from public.debts), 'ouverte', '« réglée » ne se force pas à la main');
update public.debts set status = 'remise';
select is((select status::text from public.debts), 'remise', 'remise par accord possible');
select throws_ok($$ select public.delete_operation((select id from public.operations where debt_id is not null)) $$, '22023', null,
  'un remboursement s''annule depuis la dette');

-- Objectif : suppression qui rendrait l'épargne négative
insert into public.goals (id, name, target_amount, target_date, pocket_wallet_id) values
  ('40000000-0000-0000-0000-0000000000c1', 'Moto', 100000, '2027-06-30', '10000000-0000-0000-0000-0000000000c2');
select public.record_goal_movement('vers-c-00001', '40000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', 10000, '2026-11-12');
select public.record_goal_movement('retr-c-00001', '40000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', 6000, '2026-11-12', true);
select throws_ok($$ select public.delete_operation((select id from public.operations where client_key = 'vers-c-00001')) $$, '22023', null,
  'supprimer le versement rendrait l''épargne négative');

-- Réglages et plafonds
insert into public.user_settings (cycle_start_day) values (25);
insert into public.category_caps (category, cap, pleasure) values ('Sorties', 22500, true);
select is((select cycle_start_day::int from public.user_settings), 25, 'jour de cycle enregistré');

-- Isolation
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from public.user_settings) + (select count(*)::int from public.category_caps), 0, 'D ne voit pas les réglages de C');
select throws_ok($$ select public.update_operation((select id from public.operations limit 1), 1, '2026-11-12', 'x', null, '10000000-0000-0000-0000-0000000000c1') $$,
  'P0002', null, 'D ne peut pas corriger une opération de C');

select * from finish();
rollback;
