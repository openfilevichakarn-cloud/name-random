import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { describeError } from '@/data/repository'
import type { TeamSplit } from '@/data/settings'
import type { DrawType, RandomMode, RandomResult, RepeatPolicy, ResultInput, SessionInput } from '@/data/types'
import { useLatest } from '@/hooks/useLatest'
import { playSfx } from '@/lib/audio/sfx'
import { useHistoryStore } from '@/stores/historyStore'
import { useStudioStore } from '@/stores/studioStore'
import { setStageBusy } from '@/stores/uiStore'

import { planDraw } from '../engine/engine'
import type { Candidate, DrawError, DrawPlan, DrawRequest, PoolState } from '../engine/types'
import type { StageMode, StagePhase, StageRun } from '../stages/types'

/** Everything a draw depends on. Read at the moment the draw starts. */
export interface DrawConfig {
  mode: RandomMode
  drawType: DrawType
  policy: RepeatPolicy
  /** Full pool of the selected source, before exclusions. */
  candidates: readonly Candidate[]
  pool: PoolState
  multipleCount: number
  teamSplit: TeamSplit
  teamCount: number
  teamSize: number
  /** How many face-down cards fit on the stage right now. */
  cardSlots: number
  /** Animation level × reveal pace. */
  timeScale: number
  /** Identity of the pool in the studio store. */
  poolKey: string
  /** Used to open a history session on the first draw of a round. */
  session: SessionInput
}

export interface DrawState {
  phase: StagePhase
  /** The plan being played, kept after the draw so the stage can keep showing its result. */
  plan: DrawPlan | null
  /** Which stage plays the plan. */
  mode: StageMode
  run: StageRun | null
  /** Winners revealed so far in this draw, in order. */
  revealed: Candidate[]
  /** Mystery Card: table positions turned over so far. */
  flipped: number[]
  /** History rows written for this draw (ids are needed to award stars). */
  results: RandomResult[]
  /** Why the last attempt to draw failed. Cleared by the next successful draw. */
  error: DrawError | null
}

const INITIAL_STATE: DrawState = {
  phase: 'idle',
  plan: null,
  mode: 'wheel',
  run: null,
  revealed: [],
  flipped: [],
  results: [],
  error: null,
}

const READY_MS = 850
const SUSPENSE_MS = 800
/** How long each winner of a multiple draw stays on screen before the next one starts. */
const STEP_HOLD_MS = 1900

function isNumberCandidate(candidate: Candidate): boolean {
  return candidate.id.startsWith('n:')
}

/** Name stored in the history: the full name for students, the number (or its owner) for numbers. */
function historyName(candidate: Candidate): string {
  if (isNumberCandidate(candidate)) return candidate.detail || `หมายเลข ${candidate.label}`
  return candidate.detail || candidate.label
}

/**
 * The draw pipeline as a state machine.
 *
 *   idle → ready → running → suspense → reveal → (next winner …) → summary → idle
 *
 * The outcome is computed by the engine in `start()`, before the first frame of animation.
 * While the phase is anything but `idle` every entry point that could start another draw is
 * rejected, so double clicks, key repeats and stage taps cannot overlap two draws.
 */
export function useDrawController(config: DrawConfig) {
  const [state, setState] = useState<DrawState>(INITIAL_STATE)
  // Timers and stage callbacks need the current state synchronously, not the one from their render.
  const stateRef = useRef<DrawState>(INITIAL_STATE)
  const configRef = useLatest(config)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  const drawIndexRef = useRef(0)
  const mountedRef = useRef(true)

  const update = useCallback((patch: Partial<DrawState>) => {
    stateRef.current = { ...stateRef.current, ...patch }
    if (mountedRef.current) setState(stateRef.current)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const schedule = useCallback(
    (delay: number, task: () => void) => {
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        task()
      }, delay)
    },
    [clearTimer],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
      setStageBusy(false)
    }
  }, [clearTimer])

  /** Write results to the history. Writes are serialised so rows keep their order. */
  const record = useCallback(
    (plan: DrawPlan, mode: StageMode, entries: { candidate: Candidate; pickIndex: number; teamIndex: number | null; teamName?: string }[]) => {
      const { poolKey, session } = configRef.current
      const drawIndex = drawIndexRef.current
      writeQueue.current = writeQueue.current
        .then(async () => {
          const history = useHistoryStore.getState()
          const studio = useStudioStore.getState()
          let sessionId = studio.pools[poolKey]?.sessionId ?? null
          if (!sessionId) {
            sessionId = (await history.openSession(session)).id
            studio.setSession(poolKey, sessionId)
          }
          const inputs: ResultInput[] = entries.map(({ candidate, pickIndex, teamIndex, teamName }) => ({
            sessionId,
            classroomId: session.classroomId,
            studentId: candidate.studentId,
            displayName: historyName(candidate),
            studentNumber: candidate.number,
            avatar: candidate.avatar,
            mode,
            drawType: plan.type,
            drawIndex,
            pickIndex,
            teamIndex,
            meta: teamName ? { teamName } : null,
          }))
          const created = await history.addResults(inputs)
          if (stateRef.current.plan?.id === plan.id) {
            update({ results: [...stateRef.current.results, ...created] })
          }
        })
        .catch((error: unknown) => {
          console.error(error)
          toast.error(describeError(error, 'บันทึกประวัติการสุ่มไม่สำเร็จ'))
        })
    },
    [configRef, update],
  )

  /** Make a winner official: mark as drawn and write the history row. */
  const commitWinners = useCallback(
    (plan: DrawPlan, mode: StageMode, winners: Candidate[], firstPickIndex: number) => {
      if (winners.length === 0) return
      if (plan.policy === 'no-repeat') {
        useStudioStore.getState().markDrawn(
          configRef.current.poolKey,
          winners.map((winner) => winner.id),
        )
      }
      record(
        plan,
        mode,
        winners.map((candidate, offset) => ({ candidate, pickIndex: firstPickIndex + offset, teamIndex: null })),
      )
    },
    [configRef, record],
  )

  const finish = useCallback(() => {
    clearTimer()
    setStageBusy(false)
    update({ phase: 'idle', run: null })
  }, [clearTimer, update])

  /** Move on from the reveal of one winner. */
  const advance = useCallback(() => {
    const { phase, plan, mode, revealed } = stateRef.current
    if (phase !== 'reveal' || !plan) return
    clearTimer()
    if (revealed.length < plan.picks) {
      if (mode === 'card') {
        update({ phase: 'picking', run: null })
        return
      }
      const index = revealed.length
      const winner = plan.winners[index]
      if (winner) {
        update({
          phase: 'running',
          run: { key: `${plan.id}:${index}`, winner, index, total: plan.picks, quick: true },
        })
        return
      }
    }
    if (plan.picks > 1) update({ phase: 'summary', run: null })
    else finish()
  }, [clearTimer, finish, update])

  /** Show the current run's winner. */
  const reveal = useCallback(() => {
    const { plan, mode, run, revealed } = stateRef.current
    if (!plan || !run) return
    clearTimer()
    commitWinners(plan, mode, [run.winner], revealed.length + 1)
    update({ phase: 'reveal', revealed: [...revealed, run.winner] })
    // Multiple draws keep moving on their own; a single winner waits for the teacher.
    if (plan.picks > 1) {
      const hold = STEP_HOLD_MS * Math.max(0.7, configRef.current.timeScale)
      schedule(hold, advance)
    }
  }, [advance, clearTimer, commitWinners, configRef, schedule, update])

  /** Team draws have no single winner: commit the whole split and show it. */
  const revealTeams = useCallback(() => {
    const { plan } = stateRef.current
    if (!plan) return
    clearTimer()
    let pickIndex = 0
    record(
      plan,
      'team',
      plan.teams.flatMap((team) =>
        team.members.map((candidate) => {
          pickIndex += 1
          return { candidate, pickIndex, teamIndex: team.index, teamName: team.name }
        }),
      ),
    )
    playSfx('winner')
    update({ phase: 'summary', run: null })
  }, [clearTimer, record, update])

  /** Begin a draw. Returns false when it was rejected (busy, or nothing to draw). */
  const start = useCallback((): boolean => {
    if (stateRef.current.phase !== 'idle' && stateRef.current.phase !== 'summary') return false
    const current = configRef.current
    const request: DrawRequest =
      current.drawType === 'team'
        ? {
            type: 'team',
            split: current.teamSplit,
            value: current.teamSplit === 'count' ? current.teamCount : current.teamSize,
          }
        : current.drawType === 'multiple'
          ? { type: 'multiple', count: current.multipleCount }
          : { type: 'single' }
    const mode: StageMode = current.drawType === 'team' ? 'team' : current.mode

    const outcome = planDraw({
      candidates: current.candidates,
      pool: current.pool,
      policy: current.policy,
      request,
      cardSlots: mode === 'card' ? current.cardSlots : undefined,
    })
    if (!outcome.ok) {
      playSfx('error')
      update({ error: outcome.error })
      return false
    }

    const plan = outcome.plan
    drawIndexRef.current = useStudioStore.getState().beginDraw(current.poolKey)
    setStageBusy(true)
    update({ phase: 'ready', plan, mode, run: null, revealed: [], flipped: [], results: [], error: null })

    schedule(Math.max(250, READY_MS * current.timeScale), () => {
      if (mode === 'team') {
        update({ phase: 'running' })
      } else if (mode === 'card') {
        update({ phase: 'dealing' })
      } else {
        const winner = plan.winners[0]
        if (!winner) {
          finish()
          return
        }
        update({ phase: 'running', run: { key: `${plan.id}:0`, winner, index: 0, total: plan.picks, quick: false } })
      }
    })
    return true
  }, [configRef, finish, schedule, update])

  /** Stage callback: the animation for `runKey` has come to rest. */
  const settle = useCallback(
    (runKey: string) => {
      const { phase, plan, mode, run } = stateRef.current
      if (phase !== 'running' || !plan) return
      if (mode === 'team') {
        if (runKey === plan.id) revealTeams()
        return
      }
      if (!run || run.key !== runKey) return
      update({ phase: 'suspense' })
      // The card already had its moment of suspense while it trembled.
      const beat = (mode === 'card' ? 250 : SUSPENSE_MS) * configRef.current.timeScale
      schedule(beat, reveal)
    },
    [configRef, reveal, revealTeams, schedule, update],
  )

  /** Mystery Card: the cards are on the table. */
  const dealt = useCallback(
    (dealKey: string) => {
      const { phase, plan } = stateRef.current
      if (phase === 'dealing' && plan?.id === dealKey) update({ phase: 'picking' })
    },
    [update],
  )

  /** Mystery Card: a student chose a card. */
  const pickCard = useCallback(
    (index: number) => {
      const { phase, plan, flipped, revealed } = stateRef.current
      if (phase !== 'picking' || !plan || flipped.includes(index)) return
      const winner = plan.cards[index]
      if (!winner) return
      update({
        phase: 'running',
        flipped: [...flipped, index],
        run: { key: `${plan.id}:${flipped.length}`, winner, index: revealed.length, total: plan.picks, quick: false },
      })
    },
    [update],
  )

  /** Jump over the animation straight to the result. */
  const skip = useCallback(() => {
    const { phase, plan, mode, run, revealed } = stateRef.current
    if (!plan) return
    if (phase !== 'ready' && phase !== 'dealing' && phase !== 'running' && phase !== 'suspense') return
    clearTimer()

    if (mode === 'team') {
      revealTeams()
      return
    }
    if (mode === 'card') {
      if (phase === 'ready' || phase === 'dealing') update({ phase: 'picking' })
      else reveal()
      return
    }
    if (plan.picks > 1) {
      // Reveal everyone who is still pending in one go.
      const pending = plan.winners.slice(revealed.length)
      commitWinners(plan, mode, pending, revealed.length + 1)
      update({ phase: 'summary', run: null, revealed: [...revealed, ...pending] })
      return
    }
    const winner = run?.winner ?? plan.winners[0]
    if (!winner) {
      finish()
      return
    }
    stateRef.current = {
      ...stateRef.current,
      run: run ?? { key: `${plan.id}:0`, winner, index: 0, total: 1, quick: false },
    }
    reveal()
  }, [clearTimer, commitWinners, finish, reveal, revealTeams, update])

  /** Close the result and immediately draw again. */
  const again = useCallback(() => {
    const { phase } = stateRef.current
    if (phase !== 'reveal' && phase !== 'summary') return
    finish()
    start()
  }, [finish, start])

  const close = useCallback(() => {
    const { phase } = stateRef.current
    if (phase === 'reveal' || phase === 'summary') finish()
  }, [finish])

  const dismissError = useCallback(() => update({ error: null }), [update])

  return {
    state,
    busy: state.phase !== 'idle',
    start,
    settle,
    dealt,
    pickCard,
    advance,
    skip,
    again,
    close,
    dismissError,
  }
}

export type DrawController = ReturnType<typeof useDrawController>
