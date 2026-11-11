import { Download, FlaskConical, HardDrive, History, LoaderCircle, RotateCcw, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { getRepository } from '@/data'
import { createBackup, parseBackup, type BackupParseResult } from '@/data/backup'
import { createDemoStudents, DEMO_CLASSROOM } from '@/data/demo'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { fileTimestamp, formatDateTime } from '@/lib/date'
import { downloadBlob } from '@/lib/download'
import { useDataStore } from '@/stores/dataStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStudioStore } from '@/stores/studioStore'

import { SettingGroup, SettingRow } from '../components/SettingRow'

/** Largest backup file accepted for restore. */
const MAX_BACKUP_BYTES = 30 * 1024 * 1024

type Restore = Extract<BackupParseResult, { ok: true }>
type Danger = 'history' | 'data' | 'settings' | null

const DANGER_COPY: Record<Exclude<Danger, null>, { title: string; description: string; confirm: string; success: string }> = {
  history: {
    title: 'ล้างประวัติการสุ่มทั้งหมด?',
    description: 'ประวัติทุกรายการและทุกรอบจะถูกลบถาวร รายชื่อนักเรียนและห้องเรียนไม่ได้รับผลกระทบ',
    confirm: 'ล้างประวัติ',
    success: 'ล้างประวัติแล้ว',
  },
  data: {
    title: 'ลบข้อมูลทั้งหมด?',
    description:
      'ห้องเรียน รายชื่อนักเรียน และประวัติการสุ่มทั้งหมดจะถูกลบถาวร การกระทำนี้ย้อนกลับไม่ได้ แนะนำให้ดาวน์โหลดไฟล์สำรองก่อน',
    confirm: 'ลบข้อมูลทั้งหมด',
    success: 'ลบข้อมูลทั้งหมดแล้ว',
  },
  settings: {
    title: 'คืนค่าการตั้งค่าทั้งหมด?',
    description: 'การตั้งค่าทุกหมวดจะกลับเป็นค่าเริ่มต้น ข้อมูลห้องเรียนและประวัติไม่ได้รับผลกระทบ',
    confirm: 'คืนค่าเริ่มต้น',
    success: 'คืนค่าการตั้งค่าแล้ว',
  },
}

export function DataSection() {
  const inputId = useId()
  const classrooms = useDataStore((state) => state.classrooms)
  const students = useDataStore((state) => state.students)
  const loadData = useDataStore((state) => state.load)
  const revision = useHistoryStore((state) => state.revision)
  const { run, pending } = useAsyncAction()

  const [resultCount, setResultCount] = useState<number | null>(null)
  const [restore, setRestore] = useState<Restore | null>(null)
  const [restoreSettings, setRestoreSettings] = useState(true)
  const [danger, setDanger] = useState<Danger>(null)

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Count the history through the repository (the in-memory window only covers recent results).
  useEffect(() => {
    let cancelled = false
    getRepository()
      .queryResults({ limit: 0 })
      .then((page) => {
        if (!cancelled) setResultCount(page.total)
      })
      .catch(() => {
        if (!cancelled) setResultCount(null)
      })
    return () => {
      cancelled = true
    }
    // `revision` is the trigger: recount whenever the history changes.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [revision])

  const reloadEverything = async () => {
    await Promise.all([useDataStore.getState().reload(), useHistoryStore.getState().reload()])
  }

  const downloadBackup = () =>
    run(
      async () => {
        const data = await getRepository().exportSnapshot()
        const backup = createBackup(data, useSettingsStore.getState().settings)
        downloadBlob(
          new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
          `randomizer-backup-${fileTimestamp()}.json`,
        )
      },
      { success: 'ดาวน์โหลดไฟล์สำรองแล้ว', error: 'สร้างไฟล์สำรองไม่สำเร็จ' },
    )

  const chooseBackup = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 30 MB)')
      return
    }
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }
    setRestoreSettings(parsed.settings !== null)
    setRestore(parsed)
  }

  const applyRestore = async () => {
    if (!restore) return
    await getRepository().importSnapshot(restore.data)
    if (restoreSettings && restore.settings) useSettingsStore.getState().replaceAll(restore.settings)
    await reloadEverything()
  }

  const addDemo = () =>
    run(
      async () => {
        const store = useDataStore.getState()
        const classroom = await store.createClassroom(DEMO_CLASSROOM)
        await store.addStudents(createDemoStudents(classroom.id))
      },
      { success: 'เพิ่มห้องตัวอย่างแล้ว', error: 'เพิ่มข้อมูลตัวอย่างไม่สำเร็จ' },
    )

  const applyDanger = async () => {
    if (danger === 'history') {
      await useHistoryStore.getState().clear()
      useStudioStore.getState().detachSessions()
    } else if (danger === 'data') {
      await getRepository().clearAll()
      useStudioStore.getState().clearPools()
      await reloadEverything()
    } else if (danger === 'settings') {
      useSettingsStore.getState().reset()
    }
  }

  const hasDemo = classrooms.some((classroom) => classroom.isDemo)
  const copy = danger ? DANGER_COPY[danger] : null

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup title="ที่เก็บข้อมูล" description="ข้อมูลของคุณถูกเก็บที่ใด และมีอะไรอยู่บ้าง">
        <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
          <HardDrive className="mt-0.5 size-5 shrink-0 text-neon-cyan" aria-hidden />
          <div>
            <p className="font-medium">เก็บในเบราว์เซอร์นี้ (Local)</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              ข้อมูลอยู่ในอุปกรณ์เครื่องนี้เท่านั้น ไม่ถูกส่งออกไปที่ใด หากล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง
              ข้อมูลจะไม่ตามไปด้วย จึงควรสำรองข้อมูลไว้เป็นระยะ
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-border/70 text-center">
          {[
            ['ห้องเรียน', classrooms.length],
            ['นักเรียน', students.length],
            ['ผลการสุ่ม', resultCount],
          ].map(([label, value]) => (
            <div key={label} className="px-3 py-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="tabular mt-1 text-2xl font-extrabold">{value ?? '–'}</dd>
            </div>
          ))}
        </dl>
      </SettingGroup>

      <SettingGroup title="สำรองและกู้คืน" description="ไฟล์สำรองเก็บห้องเรียน นักเรียน ประวัติ และการตั้งค่าทั้งหมดไว้ในไฟล์เดียว">
        <SettingRow label="สำรองข้อมูล" description="ดาวน์โหลดไฟล์ .json เก็บไว้ หรือนำไปใช้กับเครื่องอื่น">
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => void downloadBackup()}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            ดาวน์โหลดไฟล์สำรอง
          </Button>
        </SettingRow>
        <SettingRow
          label="กู้คืนข้อมูล"
          description="นำข้อมูลจากไฟล์สำรองมารวมกับข้อมูลปัจจุบัน รายการที่ซ้ำกันจะถูกแทนที่ด้วยข้อมูลจากไฟล์"
        >
          <label
            htmlFor={inputId}
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-secondary/80 px-5 text-[0.95rem] font-semibold transition-colors focus-within:ring-2 focus-within:ring-ring hover:border-neon-cyan/50 hover:bg-accent"
          >
            <Upload className="size-[1.15em]" aria-hidden />
            เลือกไฟล์สำรอง
            <input
              id={inputId}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(event) => {
                void chooseBackup(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
        </SettingRow>
        <SettingRow
          label="ข้อมูลตัวอย่าง"
          description={
            hasDemo
              ? 'มีห้องตัวอย่างอยู่แล้ว ลบได้จากหน้าห้องเรียน'
              : 'เพิ่มห้องตัวอย่างที่มีรายชื่อสมมติ 24 คนเพื่อทดลองใช้งาน (ติดป้ายชัดเจนว่าเป็นข้อมูลตัวอย่าง)'
          }
        >
          <Button variant="secondary" className="w-full" disabled={pending || hasDemo} onClick={() => void addDemo()}>
            <FlaskConical aria-hidden />
            เพิ่มห้องตัวอย่าง
          </Button>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="ลบข้อมูล" description="การกระทำในส่วนนี้ย้อนกลับไม่ได้">
        <SettingRow label="ล้างประวัติการสุ่ม" description="ลบประวัติทั้งหมด โดยเก็บห้องเรียนและรายชื่อไว้">
          <Button variant="destructive" className="w-full" onClick={() => setDanger('history')}>
            <History aria-hidden />
            ล้างประวัติ
          </Button>
        </SettingRow>
        <SettingRow label="ลบข้อมูลทั้งหมด" description="ลบห้องเรียน รายชื่อ และประวัติทั้งหมดในเครื่องนี้">
          <Button variant="destructive" className="w-full" onClick={() => setDanger('data')}>
            <Trash2 aria-hidden />
            ลบข้อมูลทั้งหมด
          </Button>
        </SettingRow>
        <SettingRow label="คืนค่าการตั้งค่าทั้งหมด" description="ทุกหมวดกลับเป็นค่าเริ่มต้น ไม่กระทบข้อมูล">
          <Button variant="secondary" className="w-full" onClick={() => setDanger('settings')}>
            <RotateCcw aria-hidden />
            คืนค่าเริ่มต้น
          </Button>
        </SettingRow>
      </SettingGroup>

      <ConfirmDialog
        open={restore !== null}
        onOpenChange={(open) => {
          if (!open) setRestore(null)
        }}
        title="กู้คืนข้อมูลจากไฟล์นี้?"
        description={
          restore ? (
            <div className="grid gap-3">
              {restore.exportedAt ? <p>ไฟล์สำรองเมื่อ {formatDateTime(restore.exportedAt)}</p> : null}
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-ink/50 p-3 text-foreground">
                <li>ห้องเรียน {restore.data.classrooms.length}</li>
                <li>นักเรียน {restore.data.students.length}</li>
                <li>รอบการสุ่ม {restore.data.sessions.length}</li>
                <li>ผลการสุ่ม {restore.data.results.length}</li>
              </ul>
              {restore.data.classrooms.length + restore.data.results.length === 0 ? (
                <p className="flex items-center gap-2 text-neon-gold">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  ไม่พบข้อมูลที่ใช้ได้ในไฟล์นี้
                </p>
              ) : null}
              {restore.settings ? (
                <div className="flex items-center justify-between gap-3 text-foreground">
                  <label htmlFor={`${inputId}-settings`}>กู้คืนการตั้งค่าด้วย</label>
                  <Switch id={`${inputId}-settings`} checked={restoreSettings} onCheckedChange={setRestoreSettings} />
                </div>
              ) : null}
            </div>
          ) : (
            ''
          )
        }
        confirmLabel="กู้คืนข้อมูล"
        successMessage="กู้คืนข้อมูลแล้ว"
        onConfirm={applyRestore}
      />

      <ConfirmDialog
        open={danger !== null}
        onOpenChange={(open) => {
          if (!open) setDanger(null)
        }}
        title={copy?.title ?? ''}
        description={copy?.description ?? ''}
        confirmLabel={copy?.confirm ?? ''}
        tone={danger === 'settings' ? 'default' : 'destructive'}
        successMessage={copy?.success}
        onConfirm={applyDanger}
      />
    </div>
  )
}
