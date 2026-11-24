import { CloudOff, ExternalLink, LoaderCircle, LogIn, RefreshCw, Unlink } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelative } from '@/lib/date'
import { useDriveStore } from '@/stores/driveStore'

import { DRIVE_BUSY, DRIVE_STATUS_LABELS } from '../lib/status'
import { connectDrive, disconnectDrive, syncNow } from '../lib/sync'

function GoogleDriveMark() {
  return (
    <svg viewBox="0 0 87.3 78" className="size-6 shrink-0" aria-hidden>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  )
}

interface DriveSettingsProps {
  /** Signed in to a school account: data already lives in the cloud. */
  cloudMode: boolean
}

/** Settings → Data: link this device's data to a file in the teacher's Google Drive. */
export function DriveSettings({ cloudMode }: DriveSettingsProps) {
  const drive = useDriveStore()
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const busy = DRIVE_BUSY.includes(drive.status)

  if (cloudMode) {
    return (
      <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
        <CloudOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          ตอนนี้ข้อมูลเก็บในบัญชีโรงเรียนอยู่แล้ว การบันทึกลง Google Drive ใช้ได้เมื่อออกจากระบบ (โหมดเก็บในเครื่อง)
        </p>
      </div>
    )
  }

  if (!drive.linked) {
    return (
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" data-testid="drive-settings">
        <div className="flex items-start gap-3">
          <GoogleDriveMark />
          <div>
            <p className="font-medium">บันทึกลง Google Drive</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              ห้องเรียน รายชื่อนักเรียน ประวัติ และการตั้งค่า ถูกบันทึกเป็นไฟล์ใน Drive ของคุณโดยอัตโนมัติ
              เปิดจากเครื่องไหนก็ได้ข้อมูลเดิม แอปเข้าถึงได้เฉพาะไฟล์ที่แอปสร้างเท่านั้น
            </p>
            {drive.error ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {drive.error}
              </p>
            ) : null}
          </div>
        </div>
        <Button className="shrink-0" onClick={() => void connectDrive()} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
          เชื่อมต่อ Google Drive
        </Button>
      </div>
    )
  }

  const tone = drive.status === 'saved' ? 'lime' : drive.status === 'error' || drive.status === 'conflict' ? 'destructive' : 'cyan'

  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:px-6" data-testid="drive-settings">
      <div className="flex items-start gap-3">
        <GoogleDriveMark />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            Google Drive
            <Badge variant={tone} data-testid="drive-status">
              {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : null}
              {DRIVE_STATUS_LABELS[drive.status]}
            </Badge>
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{drive.email || 'บัญชี Google'}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {drive.lastSyncedAt ? `ซิงก์ล่าสุด ${formatRelative(drive.lastSyncedAt)}` : 'ยังไม่เคยซิงก์'}
            {drive.localChanged && drive.status !== 'pending' && drive.status !== 'syncing'
              ? ' · มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึกลง Drive'
              : ''}
          </p>
          {drive.status === 'needs-auth' ? (
            <p className="mt-2 text-sm text-neon-gold">
              Google ให้สิทธิ์ครั้งละไม่เกิน 1 ชั่วโมงและหลังเปิดแอปใหม่ กด “เชื่อมต่อใหม่” เพื่อซิงก์ต่อ (ข้อมูลในเครื่องยังใช้ได้ตามปกติ)
            </p>
          ) : null}
          {drive.status === 'error' && drive.error ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {drive.error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {drive.status === 'needs-auth' ? (
          <Button onClick={() => void connectDrive()}>
            <LogIn aria-hidden />
            เชื่อมต่อใหม่
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void syncNow()} disabled={busy || drive.status === 'conflict'}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            ซิงก์ตอนนี้
          </Button>
        )}
        {drive.fileLink ? (
          <Button asChild variant="ghost">
            <a href={drive.fileLink} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              เปิดไฟล์ใน Drive
            </a>
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => setConfirmUnlink(true)}>
          <Unlink aria-hidden />
          ยกเลิกการเชื่อมต่อ
        </Button>
      </div>
      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title="ยกเลิกการเชื่อมต่อ Google Drive?"
        description="ข้อมูลยังอยู่ครบทั้งในเครื่องนี้และในไฟล์บน Drive แต่การเปลี่ยนแปลงต่อจากนี้จะไม่ถูกบันทึกลง Drive"
        confirmLabel="ยกเลิกการเชื่อมต่อ"
        tone="destructive"
        successMessage="ยกเลิกการเชื่อมต่อ Google Drive แล้ว"
        onConfirm={disconnectDrive}
      />
    </div>
  )
}
