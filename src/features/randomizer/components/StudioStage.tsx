import type { CountdownSeconds } from '@/data/settings'
import type { RandomMode } from '@/data/types'

import type { Candidate } from '../engine/types'
import type { DrawController } from '../hooks/useDrawController'
import { CardStage } from '../stages/card/CardStage'
import { CountdownStage } from '../stages/countdown/CountdownStage'
import { GachaStage } from '../stages/gacha/GachaStage'
import { SlotStage } from '../stages/slot/SlotStage'
import { TeamStage } from '../stages/team/TeamStage'
import type { StageMode, StageProps } from '../stages/types'
import { WheelStage } from '../stages/wheel/WheelStage'

interface StudioStageProps {
  controller: DrawController
  /** The stage to show: the selected game mode, or the team maker. */
  mode: StageMode
  /** Everyone who can be drawn right now. */
  eligible: readonly Candidate[]
  /** Identity of the pool; a different pool gets a fresh stage. */
  poolKey: string
  timeScale: number
  ambient: boolean
  countdownSeconds: CountdownSeconds
  /** Face-down cards that fit on the stage. */
  cardSlots: number
  teamPreview: { members: number; teams: number }
}

/** Mounts the stage of the active mode and connects it to the draw controller. */
export function StudioStage({
  controller,
  mode,
  eligible,
  poolKey,
  timeScale,
  ambient,
  countdownSeconds,
  cardSlots,
  teamPreview,
}: StudioStageProps) {
  const { state, start, settle, dealt, pickCard } = controller
  const { phase, plan } = state
  // A plan belongs to the stage that played it; other stages start clean.
  const ownPlan = plan && state.mode === mode ? plan : null
  const busy = phase !== 'idle'

  if (mode === 'team') {
    return (
      <TeamStage
        key={poolKey}
        phase={ownPlan ? phase : 'idle'}
        teams={ownPlan?.teams ?? []}
        dealKey={ownPlan?.id ?? null}
        preview={teamPreview}
        timeScale={timeScale}
        onSettled={settle}
      />
    )
  }

  if (mode === 'card') {
    return (
      <CardStage
        key={poolKey}
        phase={ownPlan ? phase : 'idle'}
        cards={ownPlan?.cards ?? []}
        dealKey={ownPlan?.id ?? null}
        flipped={ownPlan ? state.flipped : []}
        run={ownPlan ? state.run : null}
        timeScale={timeScale}
        ambient={ambient}
        placeholders={Math.max(1, Math.min(cardSlots, eligible.length || cardSlots))}
        onDealt={dealt}
        onPick={pickCard}
        onSettled={settle}
      />
    )
  }

  const props: StageProps = {
    // While a draw is playing the stage shows the pool the plan was made from.
    candidates: busy && ownPlan ? ownPlan.eligible : eligible,
    phase: ownPlan || !busy ? phase : 'idle',
    run: ownPlan ? state.run : null,
    timeScale,
    ambient,
    onSettled: settle,
    onActivate: start,
  }
  const key = `${mode satisfies RandomMode}:${poolKey}`

  switch (mode) {
    case 'wheel':
      return <WheelStage key={key} {...props} />
    case 'slot':
      return <SlotStage key={key} {...props} />
    case 'countdown':
      return <CountdownStage key={key} {...props} seconds={countdownSeconds} />
    case 'gacha':
      return <GachaStage key={key} {...props} />
  }
}
