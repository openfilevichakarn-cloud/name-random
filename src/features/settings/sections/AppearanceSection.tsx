import { Check } from 'lucide-react'

import { SegmentedControl } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import type { AccentPreset, UiScale } from '@/data/settings'
import { cn } from '@/lib/utils'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

import { SettingGroup, SettingRow } from '../components/SettingRow'

const ACCENTS: readonly { value: AccentPreset; label: string; swatch: string }[] = [
  { value: 'violet', label: 'Violet', swatch: 'var(--neon-violet)' },
  { value: 'cyan', label: 'Cyan', swatch: 'var(--neon-cyan)' },
  { value: 'pink', label: 'Pink', swatch: 'var(--neon-pink)' },
]

const SCALES: readonly { value: UiScale; label: string }[] = [
  { value: 'md', label: 'ปกติ' },
  { value: 'lg', label: 'ใหญ่' },
  { value: 'xl', label: 'ใหญ่มาก' },
]

export function AppearanceSection() {
  const appearance = useSettings('appearance')
  const update = useSettingsStore((state) => state.update)

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup title="ธีมสี" description="เลือกสีนำของปุ่มและตัวเน้น ชุดสีหลักของระบบยังคงเดิม">
        <SettingRow label="สีเน้น" description="ใช้กับปุ่มหลัก เมนูที่เลือก และแถบสถานะ">
          {/* Native radios keep arrow-key navigation and screen-reader semantics for free. */}
          <fieldset className="flex gap-3 sm:justify-end">
            <legend className="sr-only">สีเน้น</legend>
            {ACCENTS.map((accent) => {
              const selected = appearance.accent === accent.value
              return (
                <label key={accent.value} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="accent-preset"
                    value={accent.value}
                    checked={selected}
                    onChange={() => update('appearance', { accent: accent.value })}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full border-2 transition-transform hover:scale-110',
                      'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                      selected ? 'border-foreground' : 'border-transparent',
                    )}
                    style={{ backgroundColor: accent.swatch, boxShadow: `0 0 20px -4px ${accent.swatch}` }}
                  >
                    {selected ? <Check className="size-5 text-ink" strokeWidth={3} aria-hidden /> : null}
                  </span>
                  <span className="sr-only">{accent.label}</span>
                </label>
              )
            })}
          </fieldset>
        </SettingRow>
        <SettingRow label="ขนาดตัวอักษรและปุ่ม" description="เพิ่มขนาดเมื่อฉายขึ้นจอใหญ่หรือใช้กับแท็บเล็ต">
          <SegmentedControl
            label="ขนาดตัวอักษรและปุ่ม"
            value={appearance.scale}
            onValueChange={(scale) => update('appearance', { scale })}
            options={SCALES}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="พื้นหลัง" description="เอฟเฟกต์ตกแต่งด้านหลังเนื้อหา">
        <SettingRow
          label="อนุภาคเคลื่อนไหว"
          description="ละอองแสงนีออนลอยช้า ๆ (ปิดอัตโนมัติเมื่อระดับแอนิเมชันเป็น Low)"
          htmlFor="setting-particles"
        >
          <div className="flex sm:justify-end">
            <Switch
              id="setting-particles"
              checked={appearance.particles}
              onCheckedChange={(particles) => update('appearance', { particles })}
            />
          </div>
        </SettingRow>
        <SettingRow label="เส้นกริด" description="ลายตารางบาง ๆ แบบจอเกม" htmlFor="setting-grid">
          <div className="flex sm:justify-end">
            <Switch
              id="setting-grid"
              checked={appearance.grid}
              onCheckedChange={(grid) => update('appearance', { grid })}
            />
          </div>
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
