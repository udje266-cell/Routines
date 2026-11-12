begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a11', 'g@test.local'),
  ('00000000-0000-0000-0000-000000000b11', 'h@test.local');
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000b11","role":"authenticated"}';
insert into public.wallets (name, kind, opening_balance) values ('Wave H', 'wave', 1000);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a11","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values ('10000000-0000-0000-0000-000000000a11', 'Wave', 'wave', 50000);
insert into public.debts (direction, person, initial_amount) values ('je_dois', 'Koffi', 20000);
select public.record_operation('sup-cle-00001', 'sortie', '10000000-0000-0000-0000-000000000a11', 1000, '2026-11-12');
insert into public.recurring_rules (label, kind, amount, day, start_date, wallet_id) values ('Loyer', 'sortie', 25000, 5, '2026-11-01', '10000000-0000-0000-0000-000000000a11');
select lives_ok($$ select public.delete_my_account() $$, 'G supprime son compte');

reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000a11'), 0, 'compte supprimé');
select is((select count(*)::int from public.wallets where user_id = '00000000-0000-0000-0000-000000000a11')
        + (select count(*)::int from public.operations where user_id = '00000000-0000-0000-0000-000000000a11')
        + (select count(*)::int from public.debts where user_id = '00000000-0000-0000-0000-000000000a11')
        + (select count(*)::int from public.recurring_rules where user_id = '00000000-0000-0000-0000-000000000a11'), 0,
  'toutes ses données sont effacées');
select is((select count(*)::int from public.wallets where user_id = '00000000-0000-0000-0000-000000000b11'), 1, 'les données de H sont intactes');
select * from finish();
rollback;
