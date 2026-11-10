import { RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { NumberStepper } from '@/components/ui/number-stepper'
import { SegmentedControl } from '@/components/ui/toggle-group'
import { LIMITS, type RuleSettings, type TeamSplit } from '@/data/settings'
import type { DrawSource, DrawType, RepeatPolicy } from '@/data/types'

interface RuleBlockProps {
  title: string
  note?: string
  children: ReactNode
}

function RuleBlock({ title, note, children }: RuleBlockProps) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </section>
  )
}

export interface RulesPanelProps {
  rules: RuleSettings
  onRulesChange: (patch: Partial<RuleSettings>) => void
  source: DrawSource
  onSourceChange: (source: DrawSource) => void
  /** False when no classroom with students is selected — then only numbers can be drawn. */
  rosterAvailable: boolean
  drawType: DrawType
  /** Draws made in the current round. */
  drawCount: number
  /** Changes are locked while a draw is running. */
  disabled: boolean
  onNewRound: () => void
}

/** Quick access to the random rules. Edits are saved to Settings → Random Rules. */
export function RulesPanel({
  rules,
  onRulesChange,
  source,
  onSourceChange,
  rosterAvailable,
  drawType,
  drawCount,
  disabled,
  onNewRound,
}: RulesPanelProps) {
  const span = rules.numberMax - rules.numberMin + 1

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
      <RuleBlock
        title="สุ่มจาก"
        note={
          source === 'numbers'
            ? `สุ่มตัวเลข ${span} ค่า — ใช้ได้ทันทีโดยไม่ต้องมีรายชื่อ`
            : rosterAvailable
              ? undefined
              : 'ห้องนี้ยังไม่มีรายชื่อ จึงสุ่มได้เฉพาะตัวเลข'
        }
      >
        <SegmentedControl<DrawSource>
          label="สุ่มจาก"
          value={source}
          onValueChange={onSourceChange}
          disabled={disabled}
          options={[
            { value: 'students', label: 'รายชื่อ', disabled: !rosterAvailable },
            { value: 'numbers', label: 'ตัวเลข' },
          ]}
        />
        {source === 'numbers' ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1 text-xs text-muted-foreground">
              <span aria-hidden>ตั้งแต่</span>
              <NumberStepper
                label="ตัวเลขเริ่มต้น"
                value={rules.numberMin}
                min={LIMITS.number.min}
                max={rules.numberMax}
                disabled={disabled}
                onChange={(numberMin) => onRulesChange({ numberMin })}
              />
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground">
              <span aria-hidden>ถึง</span>
              <NumberStepper
                label="ตัวเลขสุดท้าย"
                value={rules.numberMax}
                min={rules.numberMin}
                max={Math.min(LIMITS.number.max, rules.numberMin + LIMITS.numberSpan - 1)}
                disabled={disabled}
                onChange={(numberMax) => onRulesChange({ numberMax })}
              />
            </div>
          </div>
        ) : null}
      </RuleBlock>

      <RuleBlock
        title="การสุ่มซ้ำ"
        note={
          rules.repeatPolicy === 'no-repeat'
            ? 'คนที่ถูกสุ่มแล้วจะไม่ถูกสุ่มซ้ำจนกว่าจะเริ่มรอบใหม่'
            : 'ทุกคนมีโอกาสถูกสุ่มได้ทุกครั้ง'
        }
      >
        <SegmentedControl<RepeatPolicy>
          label="การสุ่มซ้ำ"
          value={rules.repeatPolicy}
          onValueChange={(repeatPolicy) => onRulesChange({ repeatPolicy })}
          disabled={disabled}
          options={[
            { value: 'no-repeat', label: 'ไม่ซ้ำ' },
            { value: 'allow-repeat', label: 'ซ้ำได้' },
          ]}
        />
      </RuleBlock>

      {drawType === 'multiple' ? (
        <RuleBlock title="จำนวนที่สุ่มต่อครั้ง">
          <NumberStepper
            label="จำนวนที่สุ่มต่อครั้ง"
            value={rules.multipleCount}
            min={LIMITS.multipleCount.min}
            max={LIMITS.multipleCount.max}
            suffix="คน"
            disabled={disabled}
            onChange={(multipleCount) => onRulesChange({ multipleCount })}
          />
        </RuleBlock>
      ) : null}

      {drawType === 'team' ? (
        <RuleBlock title="การแบ่งทีม" note="ระบบจะเกลี่ยให้แต่ละทีมมีจำนวนต่างกันไม่เกิน 1 คน">
          <SegmentedControl<TeamSplit>
            label="วิธีแบ่งทีม"
            value={rules.teamSplit}
            onValueChange={(teamSplit) => onRulesChange({ teamSplit })}
            disabled={disabled}
            options={[
              { value: 'count', label: 'กำหนดจำนวนทีม' },
              { value: 'size', label: 'กำหนดคนต่อทีม' },
            ]}
          />
          {rules.teamSplit === 'count' ? (
            <NumberStepper
              label="จำนวนทีม"
              value={rules.teamCount}
              min={LIMITS.teamCount.min}
              max={LIMITS.teamCount.max}
              suffix="ทีม"
              disabled={disabled}
              onChange={(teamCount) => onRulesChange({ teamCount })}
            />
          ) : (
            <NumberStepper
              label="จำนวนคนต่อทีม"
              value={rules.teamSize}
              min={LIMITS.teamSize.min}
              max={LIMITS.teamSize.max}
              suffix="คน/ทีม"
              disabled={disabled}
              onChange={(teamSize) => onRulesChange({ teamSize })}
            />
          )}
        </RuleBlock>
      ) : null}

      <RuleBlock title="รอบการสุ่ม" note="เริ่มรอบใหม่เพื่อให้ทุกคนที่ถูกสุ่มแล้วกลับเข้ากองสุ่ม ประวัติของรอบเดิมยังคงอยู่">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-ink/50 px-3 py-2">
          <span className="text-sm">
            รอบนี้สุ่มไปแล้ว <span className="tabular font-bold text-neon-cyan">{drawCount}</span> ครั้ง
          </span>
          <Button variant="secondary" size="sm" disabled={disabled || drawCount === 0} onClick={onNewRound}>
            <RotateCcw aria-hidden />
            เริ่มรอบใหม่
          </Button>
        </div>
      </RuleBlock>
    </div>
  )
}
