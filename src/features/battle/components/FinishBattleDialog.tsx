import { LoaderCircle, Star } from 'lucide-react'
import { useId, useState } from 'react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface FinishBattleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Who wins if the game ends now, in words. */
  outcome: string
  /** Members of the winning team(s) who can receive a star (0 hides the option). */
  starCandidates: number
  pending: boolean
  onConfirm: (awardStars: boolean) => void
}

/** Confirm the end of a Team Battle, optionally giving the winners a star each. */
export function FinishBattleDialog({
  open,
  onOpenChange,
  outcome,
  starCandidates,
  pending,
  onConfirm,
}: FinishBattleDialogProps) {
  const checkboxId = useId()
  const [awardStars, setAwardStars] = useState(true)

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>จบการแข่งขัน?</AlertDialogTitle>
          <AlertDialogDescription>
            ผลตอนนี้: <strong className="text-foreground">{outcome}</strong> · เมื่อจบเกมแล้วคะแนนจะถูกล็อก
          </AlertDialogDescription>
        </AlertDialogHeader>
        {starCandidates > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-neon-gold/35 bg-neon-gold/8 p-3">
            <Checkbox
              id={checkboxId}
              checked={awardStars}
              onCheckedChange={(checked) => setAwardStars(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor={checkboxId} className="text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-neon-gold">
                <Star className="size-4 fill-current" aria-hidden />
                ให้ดาวสมาชิกทีมที่ชนะ คนละ 1 ดวง
              </span>
              <span className="text-muted-foreground">{starCandidates} คน · ดาวนับรวมในหน้าอันดับ (Class Ranking)</span>
            </label>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>แข่งต่อ</AlertDialogCancel>
          <Button disabled={pending} onClick={() => onConfirm(starCandidates > 0 && awardStars)}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            จบเกมและประกาศผล
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
