import type { Rng } from '@/features/randomizer/engine/rng'
import type { Team } from '@/features/randomizer/engine/types'

/** Score range of one team. Negative scores allow penalty points. */
export const SCORE_LIMITS = { min: -99, max: 999 } as const
/** Score changes kept for undo. */
export const MAX_LOG = 500
/** Score buttons on each team card. */
export const SCORE_STEPS = [1, 2] as const

export interface BattleMember {
  /** Candidate id (student id, or `n:<number>`). */
  id: string
  label: string
  avatar: string | null
  studentId: string | null
  /** The member's row of the team split in the history; stars for the winners are written there. */
  resultId: string | null
}

export interface BattleTeam {
  name: string
  members: BattleMember[]
  score: number
}

export interface BattleEvent {
  team: number
  delta: number
}

/** A Team Battle: the teams of one split and their scores. */
export interface Battle {
  id: string
  /** Where the teams came from: the classroom name (or number range). */
  title: string
  classroomId: string | null
  teams: BattleTeam[]
  /** Score changes, oldest first. */
  log: BattleEvent[]
  startedAt: string
  /** Set when the teacher ends the game. */
  finishedAt: string | null
  /** Stars have been given to the winning team(s). */
  starsAwarded: boolean
}

export interface CreateBattleInput {
  teams: readonly Team[]
  title: string
  classroomId: string | null
  /** History row of each member, by candidate id. */
  resultIds?: ReadonlyMap<string, string>
  now?: Date
}

export function createBattle({ teams, title, classroomId, resultIds, now = new Date() }: CreateBattleInput): Battle {
  return {
    id: crypto.randomUUID(),
    title,
    classroomId,
    teams: teams.map((team) => ({
      name: team.name,
      score: 0,
      members: team.members.map((member) => ({
        id: member.id,
        label: member.label,
        avatar: member.avatar,
        studentId: member.studentId,
        resultId: resultIds?.get(member.id) ?? null,
      })),
    })),
    log: [],
    startedAt: now.toISOString(),
    finishedAt: null,
    starsAwarded: false,
  }
}

function clampScore(score: number): number {
  return Math.min(SCORE_LIMITS.max, Math.max(SCORE_LIMITS.min, Math.round(score)))
}

/** Add `delta` points to one team. Finished battles and changes that hit a limit are left as they are. */
export function changeScore(battle: Battle, team: number, delta: number): Battle {
  const target = battle.teams[team]
  if (!target || battle.finishedAt !== null || !Number.isFinite(delta) || delta === 0) return battle
  const score = clampScore(target.score + delta)
  const applied = score - target.score
  if (applied === 0) return battle
  return {
    ...battle,
    teams: battle.teams.map((item, index) => (index === team ? { ...item, score } : item)),
    log: [...battle.log, { team, delta: applied }].slice(-MAX_LOG),
  }
}

/** Take back the most recent score change. */
export function undoLast(battle: Battle): Battle {
  const last = battle.log[battle.log.length - 1]
  if (!last || battle.finishedAt !== null) return battle
  return {
    ...battle,
    teams: battle.teams.map((item, index) =>
      index === last.team ? { ...item, score: clampScore(item.score - last.delta) } : item,
    ),
    log: battle.log.slice(0, -1),
  }
}

/** Play again with the same teams. */
export function restartBattle(battle: Battle, now: Date = new Date()): Battle {
  return {
    ...battle,
    id: crypto.randomUUID(),
    teams: battle.teams.map((team) => ({ ...team, score: 0 })),
    log: [],
    startedAt: now.toISOString(),
    finishedAt: null,
    starsAwarded: false,
  }
}

export function finishBattle(battle: Battle, now: Date = new Date()): Battle {
  return battle.finishedAt !== null ? battle : { ...battle, finishedAt: now.toISOString() }
}

/**
 * Indices of the teams in the lead (several when they share the top score).
 * Empty while every team has the same score — before anyone scores, or a draw.
 */
export function leaders(battle: Battle): number[] {
  if (battle.teams.length === 0) return []
  const best = Math.max(...battle.teams.map((team) => team.score))
  const top = battle.teams.flatMap((team, index) => (team.score === best ? [index] : []))
  return top.length === battle.teams.length ? [] : top
}

export interface Standing {
  index: number
  team: BattleTeam
  /** Competition ranking: equal scores share a rank and the next rank is skipped (1, 1, 3). */
  rank: number
}

export function standings(battle: Battle): Standing[] {
  const sorted = battle.teams
    .map((team, index) => ({ team, index }))
    .sort((a, b) => b.team.score - a.team.score || a.index - b.index)
  let rank = 0
  return sorted.map((entry, position) => {
    const previous = sorted[position - 1]
    if (!previous || previous.team.score !== entry.team.score) rank = position + 1
    return { ...entry, rank }
  })
}

/** The result in words, e.g. "ทีม 2 ชนะ" or "ทีม 1 และ ทีม 3 ชนะร่วมกัน". */
export function describeOutcome(battle: Battle, winners: readonly number[] = leaders(battle)): string {
  const names = winners.map((index) => battle.teams[index]?.name ?? '')
  if (names.length === 0) return 'เสมอกันทุกทีม'
  if (names.length === 1) return `${names[0]} ชนะ`
  return `${names.slice(0, -1).join(', ')} และ ${names[names.length - 1]} ชนะร่วมกัน`
}

/** Members of the winning team(s) whose history rows can take a star. */
export function winningMembers(battle: Battle): BattleMember[] {
  return leaders(battle).flatMap(
    (index) =>
      battle.teams[index]?.members.filter((member) => member.studentId !== null && member.resultId !== null) ?? [],
  )
}

/** Pick a random team (who answers next). */
export function pickTeam(battle: Battle, rng: Rng): number | null {
  return battle.teams.length > 0 ? rng.nextInt(battle.teams.length) : null
}

/** Pick a random member of a team (the team's speaker). */
export function pickMember(team: BattleTeam, rng: Rng): BattleMember | null {
  return team.members.length > 0 ? (team.members[rng.nextInt(team.members.length)] ?? null) : null
}

// ---------------------------------------------------------------------------
// Persistence — the battle is kept in localStorage, so treat what comes back as untrusted
// ---------------------------------------------------------------------------

type Dict = Record<string, unknown>

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' ? value.slice(0, max) : null
}

function isoDate(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null
}

function sanitizeMember(value: unknown): BattleMember | null {
  if (!isDict(value)) return null
  const id = text(value.id, 80)
  const label = text(value.label, 120)
  if (!id || !label) return null
  return {
    id,
    label,
    avatar: optionalText(value.avatar, 60) || null,
    studentId: text(value.studentId, 80),
    resultId: text(value.resultId, 80),
  }
}

function sanitizeTeam(value: unknown): BattleTeam | null {
  if (!isDict(value)) return null
  const name = text(value.name, 60)
  if (!name || !Array.isArray(value.members)) return null
  const members = value.members.map(sanitizeMember).filter((member): member is BattleMember => member !== null)
  const score = typeof value.score === 'number' && Number.isFinite(value.score) ? clampScore(value.score) : 0
  return { name, members, score }
}

/** Rebuild a battle from storage, or null when it is not one. */
export function sanitizeBattle(value: unknown): Battle | null {
  if (!isDict(value) || !Array.isArray(value.teams)) return null
  const id = text(value.id, 80)
  const startedAt = isoDate(value.startedAt)
  const teams = value.teams.map(sanitizeTeam).filter((team): team is BattleTeam => team !== null)
  if (!id || !startedAt || teams.length < 2) return null
  const log = Array.isArray(value.log)
    ? value.log
        .filter(
          (event): event is BattleEvent =>
            isDict(event) &&
            Number.isInteger(event.team) &&
            (event.team as number) >= 0 &&
            (event.team as number) < teams.length &&
            Number.isInteger(event.delta) &&
            event.delta !== 0,
        )
        .slice(-MAX_LOG)
    : []
  return {
    id,
    title: optionalText(value.title, 120) ?? '',
    classroomId: text(value.classroomId, 80),
    teams,
    log,
    startedAt,
    finishedAt: isoDate(value.finishedAt),
    starsAwarded: value.starsAwarded === true,
  }
}
