import { CloudAlert, CloudCheck, CloudUpload, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { useDriveStore } from '@/stores/driveStore'

import { DRIVE_BUSY, DRIVE_STATUS_LABELS } from '../lib/status'
import { connectDrive } from '../lib/sync'

/** Google Drive sync at a glance, in the menu. One tap reconnects when Google needs to be asked again. */
export function DriveStatusButton() {
  const linked = useDriveStore((state) => state.linked)
  const status = useDriveStore((state) => state.status)
  const navigate = useNavigate()
  if (!linked) return null

  const label = `Google Drive: ${DRIVE_STATUS_LABELS[status]}${status === 'needs-auth' ? ' (แตะเพื่อเชื่อมต่อ)' : ''}`
  const Icon = DRIVE_BUSY.includes(status)
    ? LoaderCircle
    : status === 'saved'
      ? CloudCheck
      : status === 'pending'
        ? CloudUpload
        : CloudAlert
  const tone =
    status === 'saved'
      ? 'text-neon-lime'
      : status === 'needs-auth' || status === 'error' || status === 'conflict'
        ? 'text-neon-gold'
        : 'text-neon-cyan'

  return (
    <Hint label={label} side="right">
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        className={tone}
        data-testid="drive-status-button"
        onClick={() => (status === 'needs-auth' ? void connectDrive() : void navigate('/settings?tab=data'))}
      >
        <Icon className={DRIVE_BUSY.includes(status) ? 'animate-spin' : undefined} aria-hidden />
      </Button>
    </Hint>
  )
}
