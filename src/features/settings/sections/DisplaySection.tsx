import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/ui/toggle-group'
import type { DisplaySettings, NameSize } from '@/data/settings'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

import { ResetButton } from '../components/ResetButton'
import { SettingGroup, SettingRow } from '../components/SettingRow'

const NAME_SIZES: readonly { value: NameSize; label: string }[] = [
  { value: 'md', label: 'ปกติ' },
  { value: 'lg', label: 'ใหญ่' },
  { value: 'xl', label: 'ใหญ่มาก' },
]

/** Font size of the name in the preview, mirroring the three stage sizes. */
const PREVIEW_SIZE: Record<NameSize, string> = { md: 'text-3xl', lg: 'text-4xl', xl: 'text-5xl' }

type Toggle = Extract<
  keyof DisplaySettings,
  'showAvatar' | 'showNumber' | 'showFullName' | 'keepAwake' | 'autoFullscreen'
>

const WINNER_TOGGLES: readonly { key: Toggle; label: string; description: string }[] = [
  { key: 'showAvatar', label: 'แสดง Avatar', description: 'รูปประจำตัวขนาดใหญ่เหนือชื่อ' },
  { key: 'showNumber', label: 'แสดงเลขที่', description: 'เลขที่ของนักเรียนใต้ชื่อ' },
  { key: 'showFullName', label: 'แสดงชื่อ-นามสกุล', description: 'ชื่อเต็มใต้ชื่อที่ใช้บนเวที' },
]

const SCREEN_TOGGLES: readonly { key: Toggle; label: string; description: string }[] = [
  {
    key: 'autoFullscreen',
    label: 'เต็มจออัตโนมัติ',
    description: 'เข้าสู่โหมดเต็มจอของเบราว์เซอร์พร้อมกับโหมดจอใหญ่ (หากอุปกรณ์รองรับ)',
  },
  {
    key: 'keepAwake',
    label: 'ไม่ให้หน้าจอดับ',
    description: 'ป้องกันจอพักหรือโปรเจกเตอร์ดับระหว่างอยู่ในโหมดจอใหญ่ (หากอุปกรณ์รองรับ)',
  },
]

export function DisplaySection() {
  const display = useSettings('display')
  const update = useSettingsStore((state) => state.update)

  const toggles = (items: typeof WINNER_TOGGLES) =>
    items.map((item) => (
      <SettingRow key={item.key} label={item.label} description={item.description} htmlFor={`setting-${item.key}`}>
        <div className="flex sm:justify-end">
          <Switch
            id={`setting-${item.key}`}
            checked={display[item.key]}
            onCheckedChange={(checked) => update('display', { [item.key]: checked })}
          />
        </div>
      </SettingRow>
    ))

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup
        title="หน้าประกาศผล"
        description="สิ่งที่แสดงเมื่อเปิดเผยชื่อผู้ถูกสุ่ม"
        action={<ResetButton section="display" label="การแสดงผล" />}
      >
        <div className="flex flex-col items-center gap-2 bg-ink/40 px-5 py-6 text-center" aria-label="ตัวอย่างหน้าประกาศผล">
          <p className="tag-label text-neon-gold">ตัวอย่าง</p>
          {display.showAvatar ? (
            <StudentAvatar avatar="bot:preview" seed="preview" className="size-20 ring-4 ring-neon-gold ring-offset-4 ring-offset-ink" />
          ) : null}
          <p className={`text-gradient leading-tight font-extrabold ${PREVIEW_SIZE[display.nameSize]}`}>กิต</p>
          <p className="text-sm text-foreground/85">
            {[display.showNumber ? 'เลขที่ 7' : '', display.showFullName ? 'กิตติพงษ์ ใจดี' : ''].filter(Boolean).join(' · ') ||
              ' '}
          </p>
        </div>
        <SettingRow label="ขนาดชื่อ" description="ขนาดตัวอักษรของชื่อผู้ถูกสุ่ม ปรับให้เหมาะกับระยะที่นักเรียนมองจอ">
          <SegmentedControl
            label="ขนาดชื่อ"
            value={display.nameSize}
            onValueChange={(nameSize) => update('display', { nameSize })}
            options={NAME_SIZES}
          />
        </SettingRow>
        {toggles(WINNER_TOGGLES)}
      </SettingGroup>

      <SettingGroup
        title="Big Screen Mode"
        description="โหมดจอใหญ่สำหรับโปรเจกเตอร์และ Smart TV — เปิดได้จากปุ่ม “จอใหญ่” ในสตูดิโอ หรือกดปุ่ม F"
      >
        {toggles(SCREEN_TOGGLES)}
      </SettingGroup>
    </div>
  )
}
