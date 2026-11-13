begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a51', 'u@test.local');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a51","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values ('10000000-0000-0000-0000-000000000a51', 'Wave', 'wave', 10000);
insert into public.planned_items (id, kind, label, amount, due_date, wallet_id, certainty)
  values ('20000000-0000-0000-0000-000000000a51', 'rentree', 'Client', 50000, '2026-11-20', '10000000-0000-0000-0000-000000000a51', 'attendue');
select public.record_operation('re-u-0000001', 'rentree', '10000000-0000-0000-0000-000000000a51', 50000, '2026-11-13', 'Client', null, null, 0, '20000000-0000-0000-0000-000000000a51');
select is((select status::text from public.planned_items where id = '20000000-0000-0000-0000-000000000a51'), 'reglee', 'marqué reçu');
select lives_ok($$ select public.delete_operation((select id from public.operations where client_key = 're-u-0000001')) $$, 'je ne l''ai pas reçu : annulation acceptée');
select is((select status::text || ' ' || amount from public.planned_items where id = '20000000-0000-0000-0000-000000000a51'), 'prevue 50000', 'redevient attendu, montant intact');
select is((select balance::int from public.wallet_balances where wallet_id = '10000000-0000-0000-0000-000000000a51'), 10000, 'le solde réel revient à 10 000');
-- reçu en partie puis annulé : la part est rendue
select public.record_operation('re-u-0000002', 'rentree', '10000000-0000-0000-0000-000000000a51', 20000, '2026-11-13', 'Client', null, null, 0, '20000000-0000-0000-0000-000000000a51');
select public.delete_operation((select id from public.operations where client_key = 're-u-0000002'));
select is((select amount::int from public.planned_items where id = '20000000-0000-0000-0000-000000000a51'), 50000, 'reçu en partie puis annulé : montant rétabli');
select * from finish();
rollback;
