import { motion } from 'framer-motion'

import type { FeatureSettings } from '@/data/settings'
import type { QuizOutcome } from '@/data/types'

import { canAwardStars, type WinnerExtras } from '../../engine/extras'
import type { Candidate } from '../../engine/types'
import { MissionCard } from './MissionCard'
import { QuizTimer } from './QuizTimer'
import { StarControl } from './StarControl'
import { SurpriseGift } from './SurpriseGift'

interface WinnerExtrasPanelProps {
  winner: Candidate
  extras: WinnerExtras
  features: FeatureSettings
  reduced: boolean
  onStars: (points: number) => void
  onQuiz: (outcome: QuizOutcome | null) => void
  onReroll: () => void
}

/** The game layer of a single winner: surprise reward, mission, quiz timer and stars. */
export function WinnerExtrasPanel({
  winner,
  extras,
  features,
  reduced,
  onStars,
  onQuiz,
  onReroll,
}: WinnerExtrasPanelProps) {
  const stars = canAwardStars(winner, features)
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : 0.5, duration: 0.3 }}
      className="flex w-full flex-col gap-2.5"
      data-testid="winner-extras"
    >
      {extras.reward !== null ? <SurpriseGift reward={extras.reward} reduced={reduced} /> : null}
      {extras.challenge !== null ? (
        <MissionCard
          challenge={extras.challenge}
          onReroll={features.challenge && features.challenges.length > 1 ? onReroll : undefined}
          reduced={reduced}
        />
      ) : null}
      {features.quiz ? (
        <QuizTimer
          seconds={features.answerTimer}
          outcome={extras.quiz}
          onOutcome={onQuiz}
          starReward={stars}
          reduced={reduced}
        />
      ) : null}
      {stars ? <StarControl value={extras.points} name={winner.label} onChange={onStars} reduced={reduced} /> : null}
    </motion.div>
  )
}
