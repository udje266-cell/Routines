-- Tranche 5 : suppression du compte par l'utilisateur.
-- Supprime l'utilisateur d'auth.users : toutes les tables personnelles suivent par « on delete cascade ».
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  delete from auth.users where id = v_uid;
end $$;

revoke all on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;
