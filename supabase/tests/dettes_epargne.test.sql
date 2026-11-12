begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values
  ('10000000-0000-0000-0000-0000000000a1', 'Wave', 'wave', 50000),
  ('10000000-0000-0000-0000-0000000000a2', 'Orange Money', 'orange_money', 0);
insert into public.wallets (id, name, kind, everyday) values ('10000000-0000-0000-0000-0000000000a3', 'Épargne', 'epargne', false);
insert into public.debts (id, direction, person, initial_amount) values ('30000000-0000-0000-0000-0000000000a1', 'je_dois', 'Koffi', 20000);

-- Dette partielle
select public.record_debt_payment('dette-cle-0001', '30000000-0000-0000-0000-0000000000a1', 5000, '10000000-0000-0000-0000-0000000000a1', '2026-11-12');
select public.record_debt_payment('dette-cle-0001', '30000000-0000-0000-0000-0000000000a1', 5000, '10000000-0000-0000-0000-0000000000a1', '2026-11-12');
select is((select count(*)::int from public.operations where debt_id is not null), 1, 'un remboursement réessayé = une seule opération');
select is((select 20000 - sum(amount)::int from public.debt_payments), 15000, 'reste 15 000 F');
select throws_ok($$ select public.record_debt_payment('dette-cle-0002', '30000000-0000-0000-0000-0000000000a1', 15001, '10000000-0000-0000-0000-0000000000a1', '2026-11-12') $$,
  '22023', null, 'paiement supérieur au reste refusé');
select throws_ok($$ insert into public.debt_payments (debt_id, operation_id, amount, paid_on) values ('30000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 1, '2026-11-12') $$,
  '42501', null, 'insertion directe d''un règlement interdite');
select public.cancel_debt_payment((select id from public.debt_payments));
select is((select count(*)::int from public.operations where debt_id is not null), 0, 'annulation : l''opération disparaît');
select is((select coalesce(sum(amount), 0)::int from public.debt_payments), 0, 'annulation : reste ramené à 20 000 F');
select public.record_debt_payment('dette-cle-0003', '30000000-0000-0000-0000-0000000000a1', 20000, '10000000-0000-0000-0000-0000000000a1', '2026-11-12');
select is((select status::text from public.debts), 'reglee', 'remboursement total : dette réglée');

-- Transfert et épargne
select public.record_operation('transfert-0001', 'transfert', '10000000-0000-0000-0000-0000000000a1', 10000, '2026-11-12', 'Vers OM', null, '10000000-0000-0000-0000-0000000000a2', 100);
select is((select sum(balance)::int from public.wallet_balances b join public.wallets w on w.id = b.wallet_id where w.everyday), 29900,
  'transfert entre quotidiens : total conservé hors frais (50 000 − 20 000 − 100)');
insert into public.goals (id, name, target_amount, target_date, pocket_wallet_id, from_wallet_id)
  values ('40000000-0000-0000-0000-0000000000a1', 'Fonds d’urgence', 100000, '2027-03-31', '10000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000a1');
select public.record_goal_movement('objectif-0001', '40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 10000, '2026-11-12');
select is((select balance::int from public.wallet_balances where wallet_id = '10000000-0000-0000-0000-0000000000a3'), 10000, 'versement : épargne +10 000 F');
select is((select sum(balance)::int from public.wallet_balances b join public.wallets w on w.id = b.wallet_id where w.everyday), 19900, 'versement : quotidien −10 000 F');
select throws_ok($$ select public.record_goal_movement('objectif-0002', '40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 10001, '2026-11-12', true) $$,
  '22023', null, 'retrait supérieur à l''épargne refusé');

-- Isolation
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.debts) + (select count(*)::int from public.goals) + (select count(*)::int from public.debt_payments), 0,
  'B ne voit ni dettes, ni objectifs, ni règlements de A');
select throws_ok($$ select public.record_debt_payment('dette-b-0001', '30000000-0000-0000-0000-0000000000a1', 1, '10000000-0000-0000-0000-0000000000a1', '2026-11-12') $$,
  'P0002', null, 'B ne peut pas rembourser la dette de A');

select * from finish();
rollback;
