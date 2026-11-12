begin;
create extension if not exists pgtap with schema extensions;
select plan(10);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a31', 'k@test.local'),
  ('00000000-0000-0000-0000-000000000b31', 'l@test.local');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a31","role":"authenticated"}';
insert into public.wallets (id, name, kind, opening_balance) values ('10000000-0000-0000-0000-000000000a31', 'Banque', 'banque', 0);
insert into public.wallets (id, name, kind, everyday) values ('10000000-0000-0000-0000-000000000a32', 'Épargne', 'epargne', false);
select throws_ok($$ insert into public.loans (label, lender_type, principal, annual_rate, months, first_due_date, wallet_id) values ('X', 'banque', 1000, 0.1, 12, '2026-12-05', '10000000-0000-0000-0000-000000000a32') $$,
  '22023', null, 'crédit sur une poche d''épargne refusé');
insert into public.loans (id, label, lender_type, principal, annual_rate, months, first_due_date, fees, wallet_id)
  values ('60000000-0000-0000-0000-000000000a31', 'Prêt moto', 'banque', 1000000, 0.12, 12, '2026-12-05', 20000, '10000000-0000-0000-0000-000000000a31');

select throws_ok($$ select public.record_loan_operation('deb-a-000001', '60000000-0000-0000-0000-000000000a31', 0::smallint, 1000000, '10000000-0000-0000-0000-000000000a31', '2026-11-12') $$,
  '22023', null, 'le déblocage tient compte des frais');
select public.record_loan_operation('deb-a-000002', '60000000-0000-0000-0000-000000000a31', 0::smallint, 980000, '10000000-0000-0000-0000-000000000a31', '2026-11-12');
select is((select balance::int from public.wallet_balances where wallet_id = '10000000-0000-0000-0000-000000000a31'), 980000, 'déblocage : montant net reçu');

select public.record_loan_operation('ech-a-000001', '60000000-0000-0000-0000-000000000a31', 1::smallint, 88849, '10000000-0000-0000-0000-000000000a31', '2026-12-05');
select public.record_loan_operation('ech-a-000001', '60000000-0000-0000-0000-000000000a31', 1::smallint, 88849, '10000000-0000-0000-0000-000000000a31', '2026-12-05');
select is((select count(*)::int from public.operations where loan_installment = 1), 1, 'réessai : une seule échéance');
select throws_ok($$ select public.record_loan_operation('ech-a-000002', '60000000-0000-0000-0000-000000000a31', 1::smallint, 88849, '10000000-0000-0000-0000-000000000a31', '2026-12-05') $$,
  '22023', null, 'une échéance ne se paie qu''une fois');
select throws_ok($$ update public.loans set annual_rate = 0.05 $$, '22023', null, 'conditions figées après une échéance payée');
select lives_ok($$ select public.record_loan_operation('anti-a-00001', '60000000-0000-0000-0000-000000000a31', null, 200000, '10000000-0000-0000-0000-000000000a31', '2027-05-01') $$,
  'remboursement anticipé');
select throws_ok($$ select public.update_operation((select id from public.operations where loan_installment = 1), 1, '2026-12-05', 'x', null, '10000000-0000-0000-0000-000000000a31') $$,
  '22023', null, 'une échéance de crédit ne se corrige pas directement');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000b31","role":"authenticated"}';
select is((select count(*)::int from public.loans), 0, 'L ne voit pas les crédits de K');
select throws_ok($$ select public.record_loan_operation('x-b-0000001', '60000000-0000-0000-0000-000000000a31', 2::smallint, 1, '10000000-0000-0000-0000-000000000a31', '2026-12-05') $$,
  'P0002', null, 'L ne peut pas payer le crédit de K');
select * from finish();
rollback;
