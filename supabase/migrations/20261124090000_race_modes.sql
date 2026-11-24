-- =============================================================================
-- Race modes: Go-Kart Race, Duck Race and Long-tail Boat Race join the game modes.
-- =============================================================================

alter table public.random_results drop constraint random_results_mode_check;
alter table public.random_results
  add constraint random_results_mode_check
  check (mode in ('wheel', 'slot', 'card', 'countdown', 'gacha', 'kart', 'duck', 'boat', 'team'));
