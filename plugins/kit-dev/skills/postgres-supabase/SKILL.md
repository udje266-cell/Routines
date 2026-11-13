---
name: postgres-supabase
description: Méthodes PostgreSQL / Supabase - schéma, types, index, RLS optimisée, fonctions serveur sûres et idempotentes, requêtes de diagnostic. À utiliser pour écrire une migration, une politique RLS, une fonction SQL ou accélérer une requête.
---

# PostgreSQL / Supabase : bonnes pratiques

## Types
| Usage | Type | À éviter |
|---|---|---|
| Identifiants | `uuid` (norme Supabase) ou `bigint generated always as identity` | `int` |
| Texte | `text` (+ `check` de longueur si besoin) | `varchar(255)` arbitraire |
| Horodatage | `timestamptz` | `timestamp` |
| Date civile | `date` | chaîne |
| Argent | entier dans la plus petite unité (ex. `bigint` en francs CFA) ou `numeric` | `float`, `real` |
| Drapeau | `boolean` | `int`, texte |

## Index
| Requête | Index |
|---|---|
| `where col = x` ou `> x` | B-tree (par défaut) |
| `where a = x and b > y` | composite `(a, b)` : égalité d'abord, plage ensuite |
| `jsonb @> …`, plein texte | GIN |
| Séries temporelles énormes | BRIN |
- **Toujours indexer les clés étrangères** et les colonnes utilisées par la RLS.
- Index partiel pour un sous-ensemble fréquent : `create index … where statut = 'ouverte';`
- Index couvrant : `create index … (email) include (nom);`

## RLS
```sql
alter table t enable row level security;
create policy "propriétaire" on t
  using ((select auth.uid()) = user_id)        -- le select évite un appel par ligne
  with check ((select auth.uid()) = user_id);
```
Pour l'intégrité entre tables d'un même utilisateur : clés étrangères composites `(user_id, id)`.

## Fonctions serveur (écritures sensibles)
```sql
create function public.enregistrer(p_client_key text, p_montant bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'non connecté'; end if;
  if p_montant <= 0 then raise exception 'montant invalide'; end if;
  insert into public.operations (user_id, client_key, montant)
  values ((select auth.uid()), p_client_key, p_montant)
  on conflict (user_id, client_key) do nothing          -- idempotence : un réessai ne double pas
  returning id into v_id;
  return coalesce(v_id, (select id from public.operations where user_id = (select auth.uid()) and client_key = p_client_key));
end $$;
revoke all on function public.enregistrer from public, anon;
grant execute on function public.enregistrer to authenticated;
```
- Toutes les règles métier vérifiées **dans** la fonction (le client n'est pas fiable).
- Contrôle de solde ou de reste dû : dans la même transaction, avec `for update` sur la ligne concernée.
- Si les écritures directes sont interdites : `revoke insert, update, delete on table … from authenticated;`

## Requêtes utiles
```sql
-- upsert
insert into reglages (user_id, cle, valeur) values ($1, $2, $3)
on conflict (user_id, cle) do update set valeur = excluded.valeur;
-- pagination par curseur (au lieu d'OFFSET)
select … from t where (date, id) < ($1, $2) order by date desc, id desc limit 20;
-- file de travail
update jobs set statut = 'en_cours' where id = (
  select id from jobs where statut = 'attente' order by cree_le limit 1 for update skip locked) returning *;
```

## Diagnostic
```sql
-- clés étrangères sans index
select conrelid::regclass, a.attname from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
where c.contype = 'f' and not exists (
  select 1 from pg_index i where i.indrelid = c.conrelid and a.attnum = any(i.indkey));
-- requêtes lentes (extension pg_stat_statements)
select query, mean_exec_time, calls from pg_stat_statements order by mean_exec_time desc limit 10;
```

## Règles de travail
- Une migration appliquée ne se modifie plus : nouvelle migration.
- Tests pgTAP (`supabase test db`), `supabase db lint --fail-on error`.
- Ne jamais lancer d'écriture de test sur une base en production ; régénérer les types après chaque migration.
