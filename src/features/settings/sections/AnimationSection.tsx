import { SegmentedControl } from '@/components/ui/toggle-group'
import type { AnimationLevel } from '@/data/settings'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

import { SettingGroup, SettingRow } from '../components/SettingRow'

const LEVELS: readonly { value: AnimationLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const LEVEL_NOTES: Record<AnimationLevel, string> = {
  low: 'เรียบง่ายและเร็วที่สุด ไม่มีอนุภาค ไม่มีเอฟเฟกต์เบลอ เหมาะกับเครื่องรุ่นเก่าหรือผู้ที่ไวต่อภาพเคลื่อนไหว',
  medium: 'สมดุลระหว่างความสวยงามและความลื่นไหล เหมาะกับคอมพิวเตอร์ทั่วไป',
  high: 'เอฟเฟกต์เต็มรูปแบบ อนุภาคหนาแน่นพร้อมเส้นเชื่อม เหมาะกับเครื่องที่มีการ์ดจอ',
}

export function AnimationSection() {
  const animation = useSettings('animation')
  const update = useSettingsStore((state) => state.update)

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup title="ระดับแอนิเมชัน" description="ปรับให้เหมาะกับความแรงของเครื่องที่ใช้ฉาย">
        <SettingRow label="ระดับ" description={LEVEL_NOTES[animation.level]}>
          <SegmentedControl
            label="ระดับแอนิเมชัน"
            value={animation.level}
            onValueChange={(level) => update('animation', { level })}
            options={LEVELS}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
