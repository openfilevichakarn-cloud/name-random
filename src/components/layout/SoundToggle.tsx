import { Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

/** One-tap mute for the whole app. The detailed mix lives in Settings → Sound. */
export function SoundToggle() {
  const enabled = useSettings('sound').enabled
  const update = useSettingsStore((state) => state.update)
  const label = enabled ? 'ปิดเสียง' : 'เปิดเสียง'

  return (
    <Hint label={label} side="right">
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-pressed={!enabled}
        onClick={() => update('sound', { enabled: !enabled })}
        className={enabled ? 'text-neon-cyan' : 'text-muted-foreground'}
      >
        {enabled ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
      </Button>
    </Hint>
  )
}
