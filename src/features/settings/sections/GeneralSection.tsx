import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/ui/toggle-group'
import type { NameFormat } from '@/data/settings'
import { RANDOM_MODES, type RandomMode } from '@/data/types'
import { MODE_META } from '@/features/randomizer/lib/modes'
import { getDisplayName } from '@/features/students/lib/names'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

import { ResetButton } from '../components/ResetButton'
import { SettingGroup, SettingRow } from '../components/SettingRow'

const NAME_FORMATS: readonly { value: NameFormat; label: string }[] = [
  { value: 'nickname', label: 'ชื่อเล่น' },
  { value: 'first', label: 'ชื่อจริง' },
  { value: 'full', label: 'ชื่อ-นามสกุล' },
]

/** Invented student used to illustrate the name formats. */
const EXAMPLE = { firstName: 'กิตติพงษ์', lastName: 'ใจดี', nickname: 'กิต' }

export function GeneralSection() {
  const general = useSettings('general')
  const update = useSettingsStore((state) => state.update)

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup
        title="ทั่วไป"
        description="ข้อมูลพื้นฐานและพฤติกรรมเมื่อเปิดสตูดิโอ"
        action={<ResetButton section="general" label="การตั้งค่าทั่วไป" />}
      >
        <SettingRow label="ชื่อครู" description="ใช้ทักทายบนหน้าหลัก" htmlFor="setting-teacher-name">
          <Input
            id="setting-teacher-name"
            value={general.teacherName}
            onChange={(event) => update('general', { teacherName: event.target.value })}
            maxLength={60}
            placeholder="เช่น ครูฟ้า"
            autoComplete="off"
          />
        </SettingRow>
        <SettingRow
          label="ชื่อที่แสดงบนเวทีสุ่ม"
          description={`ตัวอย่าง: ${getDisplayName(EXAMPLE, general.nameFormat)} (หากไม่มีชื่อเล่นจะใช้ชื่อจริงแทน)`}
        >
          <SegmentedControl
            label="ชื่อที่แสดงบนเวทีสุ่ม"
            value={general.nameFormat}
            onValueChange={(nameFormat) => update('general', { nameFormat })}
            options={NAME_FORMATS}
          />
        </SettingRow>
        <SettingRow label="โหมดเริ่มต้น" description="โหมดที่ถูกเลือกไว้เมื่อเปิดสตูดิโอครั้งแรกของแต่ละครั้งที่ใช้งาน">
          <Select
            value={general.defaultMode}
            onValueChange={(defaultMode) => update('general', { defaultMode: defaultMode as RandomMode })}
          >
            <SelectTrigger aria-label="โหมดเริ่มต้น">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANDOM_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {MODE_META[mode].english}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="จำห้องเรียนล่าสุด"
          description="เปิดสตูดิโอด้วยห้องเรียนที่ใช้ครั้งก่อน"
          htmlFor="setting-remember-classroom"
        >
          <div className="flex sm:justify-end">
            <Switch
              id="setting-remember-classroom"
              checked={general.rememberLastClassroom}
              onCheckedChange={(rememberLastClassroom) => update('general', { rememberLastClassroom })}
            />
          </div>
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
