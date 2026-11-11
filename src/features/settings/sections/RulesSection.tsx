import { NumberStepper } from '@/components/ui/number-stepper'
import { SegmentedControl } from '@/components/ui/toggle-group'
import { LIMITS, type TeamSplit } from '@/data/settings'
import type { RepeatPolicy } from '@/data/types'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

import { ResetButton } from '../components/ResetButton'
import { SettingGroup, SettingRow } from '../components/SettingRow'

export function RulesSection() {
  const rules = useSettings('rules')
  const update = useSettingsStore((state) => state.update)

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup
        title="กติกาการสุ่ม"
        description="ค่าเหล่านี้ใช้ร่วมกับแผง “กติกา” ในสตูดิโอ แก้ที่ใดก็มีผลทั้งสองที่"
        action={<ResetButton section="rules" label="กติกาการสุ่ม" />}
      >
        <SettingRow
          label="การสุ่มซ้ำ"
          description={
            rules.repeatPolicy === 'no-repeat'
              ? 'No Repeat — คนที่ถูกสุ่มแล้วจะไม่ถูกสุ่มซ้ำจนกว่าจะเริ่มรอบใหม่'
              : 'Repeat Allowed — ทุกคนมีโอกาสถูกสุ่มได้ทุกครั้ง'
          }
        >
          <SegmentedControl<RepeatPolicy>
            label="การสุ่มซ้ำ"
            value={rules.repeatPolicy}
            onValueChange={(repeatPolicy) => update('rules', { repeatPolicy })}
            options={[
              { value: 'no-repeat', label: 'ไม่ซ้ำ' },
              { value: 'allow-repeat', label: 'ซ้ำได้' },
            ]}
          />
        </SettingRow>
        <SettingRow label="สุ่มหลายคน" description="Multiple Random — จำนวนที่สุ่มต่อครั้งเมื่อเลือก “หลายคน”">
          <NumberStepper
            label="จำนวนที่สุ่มต่อครั้ง"
            value={rules.multipleCount}
            min={LIMITS.multipleCount.min}
            max={LIMITS.multipleCount.max}
            suffix="คน"
            className="w-full"
            onChange={(multipleCount) => update('rules', { multipleCount })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="แบ่งทีม" description="Team Random — ระบบเกลี่ยให้แต่ละทีมมีจำนวนต่างกันไม่เกิน 1 คน">
        <SettingRow label="วิธีแบ่ง">
          <SegmentedControl<TeamSplit>
            label="วิธีแบ่งทีม"
            value={rules.teamSplit}
            onValueChange={(teamSplit) => update('rules', { teamSplit })}
            options={[
              { value: 'count', label: 'จำนวนทีม' },
              { value: 'size', label: 'คนต่อทีม' },
            ]}
          />
        </SettingRow>
        <SettingRow label="จำนวนทีม" description="ใช้เมื่อแบ่งตามจำนวนทีม">
          <NumberStepper
            label="จำนวนทีม"
            value={rules.teamCount}
            min={LIMITS.teamCount.min}
            max={LIMITS.teamCount.max}
            suffix="ทีม"
            className="w-full"
            onChange={(teamCount) => update('rules', { teamCount })}
          />
        </SettingRow>
        <SettingRow label="จำนวนคนต่อทีม" description="ใช้เมื่อแบ่งตามจำนวนคนต่อทีม">
          <NumberStepper
            label="จำนวนคนต่อทีม"
            value={rules.teamSize}
            min={LIMITS.teamSize.min}
            max={LIMITS.teamSize.max}
            suffix="คน"
            className="w-full"
            onChange={(teamSize) => update('rules', { teamSize })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup
        title="สุ่มตัวเลข"
        description={`Number Random — ช่วงตัวเลขที่ใช้เมื่อสุ่มจากตัวเลข (สูงสุด ${LIMITS.numberSpan} ค่า)`}
      >
        <SettingRow label="ตั้งแต่">
          <NumberStepper
            label="ตัวเลขเริ่มต้น"
            value={rules.numberMin}
            min={LIMITS.number.min}
            max={rules.numberMax}
            className="w-full"
            onChange={(numberMin) => update('rules', { numberMin })}
          />
        </SettingRow>
        <SettingRow label="ถึง">
          <NumberStepper
            label="ตัวเลขสุดท้าย"
            value={rules.numberMax}
            min={rules.numberMin}
            max={Math.min(LIMITS.number.max, rules.numberMin + LIMITS.numberSpan - 1)}
            className="w-full"
            onChange={(numberMax) => update('rules', { numberMax })}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
