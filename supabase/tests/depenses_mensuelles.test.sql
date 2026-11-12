begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'f@test.local');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values ('10000000-0000-0000-0000-0000000000e1', 'Wave', 'wave', 50000);
insert into public.recurring_rules (id, label, kind, amount, day, start_date, wallet_id, category)
  values ('50000000-0000-0000-0000-0000000000e1', 'Loyer', 'sortie', 25000, 31, '2026-11-01', '10000000-0000-0000-0000-0000000000e1', 'Logement');

select public.settle_occurrence('loyer-nov-0001', '50000000-0000-0000-0000-0000000000e1', '2026-11-30', 25000, '10000000-0000-0000-0000-0000000000e1', '2026-11-29');
select public.settle_occurrence('loyer-nov-0001', '50000000-0000-0000-0000-0000000000e1', '2026-11-30', 25000, '10000000-0000-0000-0000-0000000000e1', '2026-11-29');
select is((select count(*)::int from public.operations), 1, 'réessai avec la même clé : une seule opération');
select throws_ok($$ select public.settle_occurrence('loyer-nov-0002', '50000000-0000-0000-0000-0000000000e1', '2026-11-30', 25000, '10000000-0000-0000-0000-0000000000e1', '2026-11-29') $$,
  '22023', null, 'une occurrence ne se règle qu''une fois');
select is((select balance::int from public.wallet_balances), 25000, 'le règlement diminue le solde réel');

insert into public.recurring_overrides (rule_id, original_date, new_date, new_amount)
  values ('50000000-0000-0000-0000-0000000000e1', '2026-12-31', '2027-01-03', 27000);
select is((select new_amount::int from public.recurring_overrides), 27000, 'exception sur une seule occurrence');

select public.split_recurring_rule('50000000-0000-0000-0000-0000000000e1', '2027-01-31', 30000, 5::smallint, 'Loyer', '10000000-0000-0000-0000-0000000000e1');
select is((select end_date from public.recurring_rules where id = '50000000-0000-0000-0000-0000000000e1'), '2027-01-30'::date, 'l''ancienne règle s''arrête la veille');
select is((select amount::int from public.recurring_rules where start_date = '2027-01-31'), 30000, 'la nouvelle règle prend le relais');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok($$ select public.settle_occurrence('loyer-f-00001', '50000000-0000-0000-0000-0000000000e1', '2026-12-31', 1, '10000000-0000-0000-0000-0000000000e1', '2026-12-31') $$,
  'P0002', null, 'F ne peut pas régler la dépense de E');
select * from finish();
rollback;
