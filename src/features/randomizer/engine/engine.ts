import type { RepeatPolicy } from '@/data/types'
import { createId } from '@/lib/id'

import { cryptoRng, type Rng } from './rng'
import { pickOne, sample, shuffle } from './shuffle'
import type { Candidate, DrawError, DrawErrorCode, DrawOutcome, DrawPlan, DrawRequest, PoolState, Team } from './types'

const MESSAGES: Record<DrawErrorCode, string> = {
  'empty-pool': 'ไม่มีผู้เข้าร่วมในกองสุ่ม กรุณาเพิ่มรายชื่อหรือคืนสิทธิ์ผู้ที่ถูกตัดออก',
  'round-complete': 'สุ่มครบทุกคนแล้ว กด “เริ่มรอบใหม่” เพื่อสุ่มอีกครั้ง',
  'not-enough': 'ต้องมีผู้เข้าร่วมอย่างน้อย 2 คนจึงจะแบ่งทีมได้',
  'invalid-request': 'การตั้งค่าการสุ่มไม่ถูกต้อง',
}

function fail(code: DrawErrorCode): { ok: false; error: DrawError } {
  return { ok: false, error: { code, message: MESSAGES[code] } }
}

/** Everyone the teacher has not taken out of the pool. */
export function getActive(candidates: readonly Candidate[], pool: PoolState): Candidate[] {
  if (pool.excludedIds.length === 0) return [...candidates]
  const excluded = new Set(pool.excludedIds)
  return candidates.filter((candidate) => !excluded.has(candidate.id))
}

/** Who can win the next draw: active candidates, minus those already drawn when repeats are off. */
export function getEligible(candidates: readonly Candidate[], pool: PoolState, policy: RepeatPolicy): Candidate[] {
  const active = getActive(candidates, pool)
  if (policy === 'allow-repeat' || pool.drawnIds.length === 0) return active
  const drawn = new Set(pool.drawnIds)
  return active.filter((candidate) => !drawn.has(candidate.id))
}

/** How many teams a request produces for `memberCount` people (always at least 2, at most one per person). */
export function resolveTeamCount(memberCount: number, split: 'count' | 'size', value: number): number {
  const wanted = split === 'count' ? value : Math.ceil(memberCount / Math.max(1, value))
  return Math.min(memberCount, Math.max(2, Math.floor(wanted)))
}

/** Shuffle the members and deal them round-robin, so team sizes never differ by more than one. */
export function makeTeams(members: readonly Candidate[], teamCount: number, rng: Rng = cryptoRng): Team[] {
  const teams: Team[] = Array.from({ length: teamCount }, (_unused, index) => ({
    index,
    name: `ทีม ${index + 1}`,
    members: [],
  }))
  shuffle(members, rng).forEach((member, position) => {
    teams[position % teamCount]?.members.push(member)
  })
  return teams
}

export interface PlanInput {
  /** The full pool for the selected source, before exclusions. */
  candidates: readonly Candidate[]
  pool: PoolState
  policy: RepeatPolicy
  request: DrawRequest
  /** Mystery Card: deal this many face-down cards and let the students choose. */
  cardSlots?: number
  /** Defaults to the crypto RNG; tests inject a seeded one. */
  rng?: Rng
  id?: string
}

/**
 * Decide the outcome of a draw. Pure apart from the RNG: nothing is stored and nothing is animated.
 * The caller commits the plan (marks winners as drawn, writes history) once it has been revealed.
 */
export function planDraw(input: PlanInput): DrawOutcome {
  const { candidates, pool, policy, request, cardSlots, rng = cryptoRng } = input
  const active = getActive(candidates, pool)
  if (active.length === 0) return fail('empty-pool')

  const base = {
    id: input.id ?? createId(),
    policy,
    winners: [] as Candidate[],
    teams: [] as Team[],
    cards: [] as Candidate[],
    clamped: false,
  }

  if (request.type === 'team') {
    if (!Number.isFinite(request.value) || request.value < 1) return fail('invalid-request')
    // Teams always include everyone who is taking part, drawn earlier in the round or not.
    if (active.length < 2) return fail('not-enough')
    const teamCount = resolveTeamCount(active.length, request.split, request.value)
    const plan: DrawPlan = {
      ...base,
      type: 'team',
      eligible: active,
      teams: makeTeams(active, teamCount, rng),
      picks: active.length,
      clamped: request.split === 'count' && teamCount !== Math.floor(request.value),
      remainingAfter: null,
      roundComplete: false,
    }
    return { ok: true, plan }
  }

  const requested = request.type === 'single' ? 1 : request.count
  if (!Number.isInteger(requested) || requested < 1) return fail('invalid-request')

  const eligible = getEligible(candidates, pool, policy)
  if (eligible.length === 0) return fail(policy === 'no-repeat' ? 'round-complete' : 'empty-pool')

  const remaining = (picks: number): Pick<DrawPlan, 'remainingAfter' | 'roundComplete'> => {
    if (policy !== 'no-repeat') return { remainingAfter: null, roundComplete: false }
    const remainingAfter = eligible.length - picks
    return { remainingAfter, roundComplete: remainingAfter === 0 }
  }

  if (cardSlots !== undefined) {
    if (!Number.isInteger(cardSlots) || cardSlots < 1) return fail('invalid-request')
    // The deal fixes which name is under which card before any card is shown.
    const cards = sample(eligible, cardSlots, rng)
    const picks = Math.min(requested, cards.length)
    const plan: DrawPlan = {
      ...base,
      type: request.type,
      eligible,
      cards,
      picks,
      clamped: picks < requested,
      ...remaining(picks),
    }
    return { ok: true, plan }
  }

  const picks = Math.min(requested, eligible.length)
  // Winners inside one draw are always distinct. A single draw with repeats allowed is a plain
  // independent pick; everything else goes through the (partial) Fisher–Yates shuffle.
  const winners =
    request.type === 'single' && policy === 'allow-repeat' ? [pickOne(eligible, rng)] : sample(eligible, picks, rng)
  const plan: DrawPlan = {
    ...base,
    type: request.type,
    eligible,
    winners,
    picks,
    clamped: picks < requested,
    ...remaining(picks),
  }
  return { ok: true, plan }
}
