import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/ui/toggle-group'
import { COUNTDOWN_OPTIONS, type AnimationLevel, type CountdownSeconds, type RevealPace } from '@/data/settings'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

import { ResetButton } from '../components/ResetButton'
import { SettingGroup, SettingRow } from '../components/SettingRow'

const LEVELS: readonly { value: AnimationLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const LEVEL_NOTES: Record<AnimationLevel, string> = {
  low: 'เรียบง่ายและเร็วที่สุด ไม่มีอนุภาค ไม่มีเอฟเฟกต์เบลอ ไม่มีคอนเฟตตี เหมาะกับเครื่องรุ่นเก่าหรือผู้ที่ไวต่อภาพเคลื่อนไหว',
  medium: 'สมดุลระหว่างความสวยงามและความลื่นไหล เหมาะกับคอมพิวเตอร์ทั่วไป',
  high: 'เอฟเฟกต์เต็มรูปแบบ อนุภาคหนาแน่น คอนเฟตตีเต็มจอ และจอสั่นตอนประกาศผล เหมาะกับเครื่องที่มีการ์ดจอ',
}

const PACES: readonly { value: RevealPace; label: string }[] = [
  { value: 'short', label: 'สั้น' },
  { value: 'normal', label: 'ปกติ' },
  { value: 'long', label: 'ยาว' },
]

const PACE_NOTES: Record<RevealPace, string> = {
  short: 'สุ่มไว เหมาะกับการเรียกชื่อบ่อย ๆ',
  normal: 'จังหวะลุ้นกำลังดี',
  long: 'ลากจังหวะลุ้นให้นานขึ้น เหมาะกับรางวัลใหญ่',
}

export function AnimationSection() {
  const animation = useSettings('animation')
  const update = useSettingsStore((state) => state.update)

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup
        title="ระดับแอนิเมชัน"
        description="ปรับให้เหมาะกับความแรงของเครื่องที่ใช้ฉาย"
        action={<ResetButton section="animation" label="แอนิเมชัน" />}
      >
        <SettingRow label="ระดับ" description={LEVEL_NOTES[animation.level]}>
          <SegmentedControl
            label="ระดับแอนิเมชัน"
            value={animation.level}
            onValueChange={(level) => update('animation', { level })}
            options={LEVELS}
          />
        </SettingRow>
        <SettingRow
          label="คอนเฟตตี"
          description="โปรยกระดาษสีเมื่อประกาศผล (ระดับ Low ไม่แสดงคอนเฟตตี)"
          htmlFor="setting-confetti"
        >
          <div className="flex sm:justify-end">
            <Switch
              id="setting-confetti"
              checked={animation.confetti}
              onCheckedChange={(confetti) => update('animation', { confetti })}
            />
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="จังหวะการสุ่ม" description="ความยาวของช่วงลุ้นก่อนเปิดเผยชื่อ">
        <SettingRow label="ความยาวของการสุ่ม" description={PACE_NOTES[animation.pace]}>
          <SegmentedControl
            label="ความยาวของการสุ่ม"
            value={animation.pace}
            onValueChange={(pace) => update('animation', { pace })}
            options={PACES}
          />
        </SettingRow>
        <SettingRow label="โหมดนับถอยหลัง" description="จำนวนที่เริ่มนับในโหมด Countdown">
          <SegmentedControl
            label="จำนวนที่เริ่มนับถอยหลัง"
            value={String(animation.countdownSeconds)}
            onValueChange={(value) => update('animation', { countdownSeconds: Number(value) as CountdownSeconds })}
            options={COUNTDOWN_OPTIONS.map((seconds) => ({ value: String(seconds), label: `${seconds}` }))}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
