import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { SettingsSection } from '@/data/settings'
import { useSettingsStore } from '@/stores/settingsStore'

interface ResetButtonProps {
  section: SettingsSection
  /** Name of the section in the confirmation toast. */
  label: string
}

/** Restore one settings section to its defaults. */
export function ResetButton({ section, label }: ResetButtonProps) {
  const reset = useSettingsStore((state) => state.reset)
  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0"
      onClick={() => {
        reset(section)
        toast.success(`คืนค่าเริ่มต้นของ${label}แล้ว`)
      }}
    >
      <RotateCcw aria-hidden />
      คืนค่าเริ่มต้น
    </Button>
  )
}
