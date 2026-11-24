import { HardDrive, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/date'
import { useDriveStore, type DataCounts } from '@/stores/driveStore'

import { resolveConflict } from '../lib/sync'

function Counts({ value }: { value: DataCounts }) {
  return (
    <p className="tabular text-sm text-muted-foreground">
      ห้องเรียน {value.classrooms} · นักเรียน {value.students} คน · ผลการสุ่ม {value.results}
    </p>
  )
}

/** Shown when this device and the Drive file both changed: the teacher picks which one to keep. */
export function DriveConflictDialog() {
  const conflict = useDriveStore((state) => state.conflict)
  const status = useDriveStore((state) => state.status)
  const [choosing, setChoosing] = useState<'drive' | 'device' | null>(null)
  const open = status === 'conflict' && conflict !== null

  const choose = async (keep: 'drive' | 'device') => {
    setChoosing(keep)
    try {
      await resolveConflict(keep)
    } finally {
      setChoosing(null)
    }
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ข้อมูลในเครื่องนี้กับ Google Drive ไม่ตรงกัน</AlertDialogTitle>
          <AlertDialogDescription>
            เลือกว่าจะใช้ข้อมูลชุดไหน ชุดที่ไม่ได้เลือกจะถูกแทนที่ หากไม่แน่ใจ ให้ปิดหน้าต่างนี้แล้วดาวน์โหลดไฟล์สำรองก่อน
          </AlertDialogDescription>
        </AlertDialogHeader>
        {conflict ? (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-border bg-ink/40 p-3">
              <p className="font-semibold">ไฟล์ใน Google Drive</p>
              {conflict.drive ? (
                <>
                  <Counts value={conflict.drive} />
                  <p className="text-sm text-muted-foreground">แก้ไขล่าสุด {formatDateTime(conflict.drive.modifiedTime)}</p>
                </>
              ) : (
                <p className="text-sm text-destructive">อ่านไฟล์ไม่ได้ (ไฟล์อาจเสียหาย) ใช้ได้เฉพาะข้อมูลในเครื่องนี้</p>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-ink/40 p-3">
              <p className="flex items-center gap-1.5 font-semibold">
                <HardDrive className="size-4" aria-hidden />
                เครื่องนี้
              </p>
              <Counts value={conflict.device} />
            </div>
          </div>
        ) : null}
        <AlertDialogFooter className="flex-wrap">
          <Button
            variant="ghost"
            disabled={choosing !== null}
            onClick={() => useDriveStore.getState().set({ status: 'needs-auth', conflict: null })}
          >
            ตัดสินใจภายหลัง
          </Button>
          <Button variant="secondary" disabled={choosing !== null} onClick={() => void choose('device')}>
            {choosing === 'device' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            ใช้ข้อมูลในเครื่องนี้
          </Button>
          {conflict?.drive ? (
            <Button disabled={choosing !== null} onClick={() => void choose('drive')}>
              {choosing === 'drive' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              ใช้ข้อมูลจาก Drive
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
