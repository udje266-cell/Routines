-- « Quoi ? » : un nom facultatif pour un achat testé (pour le retrouver dans les achats en pause).
alter table public.purchase_intents
  add column if not exists label text check (label is null or length(label) between 1 and 60);
