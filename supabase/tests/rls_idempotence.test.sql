begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'awa@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'koffi@test.local');

-- Compte A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance)
  values ('10000000-0000-0000-0000-00000000000a', 'Wave', 'wave', 30000);
insert into public.planned_items (id, kind, label, amount, due_date, wallet_id, source)
  values ('20000000-0000-0000-0000-00000000000a', 'sortie', 'Loyer', 25000, '2026-11-13', '10000000-0000-0000-0000-00000000000a', 'facture');

select lives_ok($$ select public.record_operation('cle-achat-0001', 'sortie', '10000000-0000-0000-0000-00000000000a', 8000, '2026-11-12', 'Achat', 'Loisirs') $$,
  'A enregistre une dépense');
select lives_ok($$ select public.record_operation('cle-achat-0001', 'sortie', '10000000-0000-0000-0000-00000000000a', 8000, '2026-11-12', 'Achat', 'Loisirs') $$,
  'réessai avec la même clé');
select is((select count(*)::int from public.operations), 1, 'une seule opération après réessai');
select is((select balance from public.wallet_balances), 22000::bigint, 'solde réel 22 000 F');

select public.record_operation('cle-loyer-0001', 'sortie', '10000000-0000-0000-0000-00000000000a', 10000, '2026-11-13', 'Loyer partiel', null, null, 0, '20000000-0000-0000-0000-00000000000a');
select is((select amount from public.planned_items), 15000::bigint, 'un règlement partiel réduit la partie prévue');

-- Compte B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.wallets), 0, 'B ne lit pas les portefeuilles de A');
select is((select count(*)::int from public.operations), 0, 'B ne lit pas les opérations de A');
update public.wallets set name = 'piraté' where id = '10000000-0000-0000-0000-00000000000a';
select throws_ok($$ select public.record_operation('cle-b-000001', 'sortie', '10000000-0000-0000-0000-00000000000a', 1000, '2026-11-12') $$,
  '23503', null, 'B ne peut pas écrire sur le portefeuille de A');

reset role;
select is((select name from public.wallets where id = '10000000-0000-0000-0000-00000000000a'), 'Wave', 'la modification de B est sans effet');

select * from finish();
rollback;
