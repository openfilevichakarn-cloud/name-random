import { Info, Play, Square } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/ui/toggle-group'
import { SOUND_THEMES as THEME_IDS, type MusicMode, type SoundSettings, type SoundThemeId } from '@/data/settings'
import { playSfx, SFX_EVENTS, type SfxEvent } from '@/lib/audio/sfx'
import { soundManager, type AudioStatus } from '@/lib/audio/soundManager'
import { SOUND_THEMES } from '@/lib/audio/themes'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

import { ResetButton } from '../components/ResetButton'
import { SettingGroup, SettingRow } from '../components/SettingRow'

const EVENT_LABELS: Record<SfxEvent, string> = {
  click: 'คลิกปุ่ม',
  hover: 'ชี้ปุ่ม',
  spin: 'เริ่มหมุน',
  tick: 'ติ๊ก',
  suspense: 'ลุ้น',
  countdown: 'นับถอยหลัง',
  reveal: 'เปิดเผย',
  winner: 'ประกาศผล',
  confetti: 'คอนเฟตตี',
  error: 'แจ้งเตือน',
}

const MUSIC_MODES: readonly { value: MusicMode; label: string }[] = [
  { value: 'off', label: 'ปิด' },
  { value: 'draw', label: 'ตอนสุ่ม' },
  { value: 'always', label: 'ตลอดในสตูดิโอ' },
]

const MUSIC_NOTES: Record<MusicMode, string> = {
  off: 'ไม่มีเพลงประกอบ มีเฉพาะเสียงเอฟเฟกต์',
  draw: 'เพลงเร้าใจดังเฉพาะช่วงที่กำลังสุ่ม',
  always: 'มีเพลงเบา ๆ ตลอดเวลาที่อยู่ในสตูดิโอ และเร้าใจขึ้นตอนสุ่ม',
}

const STATUS_NOTES: Partial<Record<AudioStatus, string>> = {
  locked: 'เบราว์เซอร์อนุญาตให้เล่นเสียงหลังจากแตะหรือคลิกครั้งแรกเท่านั้น แตะที่ใดก็ได้เพื่อเปิดระบบเสียง',
  loading: 'กำลังเตรียมเสียง…',
  unsupported: 'เบราว์เซอร์นี้ไม่รองรับ Web Audio จึงไม่มีเสียง',
}

interface VolumeRowProps {
  label: string
  description: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}

function VolumeRow({ label, description, value, disabled, onChange }: VolumeRowProps) {
  const percent = Math.round(value * 100)
  return (
    <SettingRow label={label} description={description}>
      <div className="flex items-center gap-3">
        <Slider
          thumbLabel={label}
          value={[percent]}
          min={0}
          max={100}
          step={5}
          disabled={disabled}
          onValueChange={([next]) => onChange((next ?? 0) / 100)}
          className="sm:w-56"
        />
        <span className="tabular w-11 shrink-0 text-right text-sm text-muted-foreground">{percent}%</span>
      </div>
    </SettingRow>
  )
}

export function SoundSection() {
  const sound = useSettings('sound')
  const update = useSettingsStore((state) => state.update)
  const status = useSyncExternalStore(
    (onChange) => soundManager.subscribe(onChange),
    () => soundManager.getStatus(),
  )
  const [previewing, setPreviewing] = useState(false)
  const set = (patch: Partial<SoundSettings>) => update('sound', patch)

  // The music preview must not outlive this page.
  useEffect(() => () => soundManager.previewMusic(null), [])

  const togglePreview = () => {
    const next = !previewing
    setPreviewing(next)
    soundManager.previewMusic(next ? 'draw' : null)
  }

  const note = STATUS_NOTES[status]
  const muted = !sound.enabled

  return (
    <div className="flex flex-col gap-5">
      {note ? (
        <p className="flex items-start gap-2 rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10 px-4 py-3 text-sm text-neon-cyan" role="status">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {note}
        </p>
      ) : null}

      <SettingGroup
        title="ระดับเสียง"
        description="ปรับเสียงรวม เพลง และเอฟเฟกต์แยกกันได้"
        action={<ResetButton section="sound" label="เสียง" />}
      >
        <SettingRow label="เปิดเสียง" description="ปิดเพื่อใช้งานแบบเงียบทั้งระบบ" htmlFor="setting-sound-enabled">
          <div className="flex sm:justify-end">
            <Switch id="setting-sound-enabled" checked={sound.enabled} onCheckedChange={(enabled) => set({ enabled })} />
          </div>
        </SettingRow>
        <VolumeRow
          label="Master Volume"
          description="ระดับเสียงรวมของทั้งระบบ"
          value={sound.master}
          disabled={muted}
          onChange={(master) => set({ master })}
        />
        <VolumeRow
          label="Music Volume"
          description="เพลงประกอบระหว่างการสุ่ม"
          value={sound.music}
          disabled={muted}
          onChange={(music) => set({ music })}
        />
        <VolumeRow
          label="SFX Volume"
          description="เสียงปุ่ม เสียงหมุน และเสียงประกาศผล"
          value={sound.sfx}
          disabled={muted}
          onChange={(sfx) => set({ sfx })}
        />
      </SettingGroup>

      <SettingGroup title="Sound Theme" description="เสียงทั้งหมดถูกสังเคราะห์ขึ้นในแอป ไม่มีไฟล์เสียงภายนอก">
        <SettingRow label="ธีมเสียง" description={SOUND_THEMES[sound.theme].description}>
          <SegmentedControl<SoundThemeId>
            label="ธีมเสียง"
            value={sound.theme}
            onValueChange={(theme) => set({ theme })}
            options={THEME_IDS.map((id) => ({ value: id, label: SOUND_THEMES[id].label }))}
          />
        </SettingRow>
        <SettingRow label="ทดลองฟัง" description="กดเพื่อฟังเสียงของแต่ละเหตุการณ์ในธีมที่เลือก" stacked>
          {/* These buttons are the sound: the generic click sound would only get in the way. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-sfx="off">
            {SFX_EVENTS.map((event) => (
              <Button
                key={event}
                variant="secondary"
                size="sm"
                disabled={muted || status !== 'ready'}
                onClick={() => playSfx(event)}
              >
                <Play aria-hidden />
                {EVENT_LABELS[event]}
              </Button>
            ))}
          </div>
        </SettingRow>
        <SettingRow
          label="เสียงเมื่อชี้ปุ่ม"
          description="เสียงเบา ๆ เมื่อเลื่อนเมาส์ผ่านปุ่ม (ไม่มีผลบนจอสัมผัส)"
          htmlFor="setting-sound-hover"
        >
          <div className="flex sm:justify-end">
            <Switch id="setting-sound-hover" checked={sound.hover} disabled={muted} onCheckedChange={(hover) => set({ hover })} />
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="เพลงประกอบ" description="เพลงถูกสร้างสดตามธีมเสียงที่เลือก">
        <SettingRow label="เล่นเพลงเมื่อ" description={MUSIC_NOTES[sound.musicMode]}>
          <SegmentedControl<MusicMode>
            label="เล่นเพลงเมื่อ"
            value={sound.musicMode}
            onValueChange={(musicMode) => set({ musicMode })}
            options={MUSIC_MODES}
            disabled={muted}
          />
        </SettingRow>
        <SettingRow label="ทดลองฟังเพลง" description="ฟังเพลงช่วงสุ่มของธีมนี้">
          <Button
            variant="secondary"
            className="w-full"
            disabled={muted || status !== 'ready' || sound.music === 0}
            aria-pressed={previewing}
            onClick={togglePreview}
          >
            {previewing ? <Square aria-hidden /> : <Play aria-hidden />}
            {previewing ? 'หยุดเพลง' : 'เล่นเพลงตัวอย่าง'}
          </Button>
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
