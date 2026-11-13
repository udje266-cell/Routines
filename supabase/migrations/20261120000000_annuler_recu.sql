-- « Je ne l'ai pas reçu / pas payé » : supprimer l'opération qui a réglé une échéance prévue
-- remet l'échéance en attente (statut « prevue », montant rétabli) au lieu de refuser.
create or replace function public.delete_operation(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_op public.operations;
  v_goal public.goals;
  v_planned public.planned_items;
  v_left bigint;
begin
  select * into v_op from public.operations where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'opération introuvable' using errcode = 'P0002'; end if;
  if v_op.debt_id is not null then raise exception 'annulez ce remboursement depuis la dette' using errcode = '22023'; end if;
  if v_op.goal_id is not null then
    select * into v_goal from public.goals where id = v_op.goal_id for update;
    v_left := coalesce((select sum(case when to_wallet_id = v_goal.pocket_wallet_id then amount else -amount end)
                        from public.operations where goal_id = v_goal.id and id <> v_op.id), 0);
    if v_left < 0 then raise exception 'suppression impossible : l''épargne deviendrait négative' using errcode = '22023'; end if;
  end if;
  if v_op.planned_item_id is not null then
    select * into v_planned from public.planned_items where id = v_op.planned_item_id and user_id = v_op.user_id for update;
    if found then
      if v_planned.status = 'reglee' then
        -- réglée en entier par cette opération : l'échéance redevient attendue avec son montant restant
        update public.planned_items set status = 'prevue' where id = v_planned.id;
      elsif v_planned.status = 'prevue' then
        -- réglée en partie : on rend la part payée
        update public.planned_items set amount = amount + v_op.amount where id = v_planned.id;
      end if;
    end if;
  end if;
  delete from public.operations where id = p_id;
end $$;
revoke all on function public.delete_operation from public, anon;
grant execute on function public.delete_operation to authenticated;
