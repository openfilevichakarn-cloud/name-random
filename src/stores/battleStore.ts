import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  changeScore,
  finishBattle,
  restartBattle,
  sanitizeBattle,
  undoLast,
  type Battle,
} from '@/features/battle/lib/battle'
import { getSafeStorage, STORAGE_PREFIX } from '@/lib/storage'

interface BattleState {
  /** The Team Battle in progress (or just finished), or null. */
  battle: Battle | null
  start: (battle: Battle) => void
  score: (team: number, delta: number) => void
  undo: () => void
  finish: () => void
  /** Same teams, scores back to zero. */
  restart: () => void
  markStarsAwarded: () => void
  /** The history was cleared: the members' rows are gone, so no stars can be written for this game. */
  detachResults: () => void
  clear: () => void
}

/**
 * Team Battle scoreboard. Persisted, so a reload in the middle of a game keeps the scores.
 */
export const useBattleStore = create<BattleState>()(
  persist(
    (set) => {
      const apply = (change: (battle: Battle) => Battle) =>
        set((state) => (state.battle ? { battle: change(state.battle) } : state))

      return {
        battle: null,
        start: (battle) => set({ battle }),
        score: (team, delta) => apply((battle) => changeScore(battle, team, delta)),
        undo: () => apply(undoLast),
        finish: () => apply((battle) => finishBattle(battle)),
        restart: () => apply((battle) => restartBattle(battle)),
        markStarsAwarded: () => apply((battle) => ({ ...battle, starsAwarded: true })),
        detachResults: () =>
          apply((battle) => ({
            ...battle,
            teams: battle.teams.map((team) => ({
              ...team,
              members: team.members.map((member) => ({ ...member, resultId: null })),
            })),
          })),
        clear: () => set({ battle: null }),
      }
    },
    {
      name: `${STORAGE_PREFIX}battle`,
      version: 1,
      storage: createJSONStorage(getSafeStorage),
      partialize: ({ battle }) => ({ battle }),
      merge: (persisted, current) => ({
        ...current,
        battle: sanitizeBattle((persisted as { battle?: unknown } | undefined)?.battle),
      }),
    },
  ),
)
