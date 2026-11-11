import { Check, Cloud, Copy, Eye, LoaderCircle, LogIn, LogOut, RefreshCw, School, Upload, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { describeAuthError } from '@/features/auth/lib/errors'
import { ROLE_LABELS } from '@/features/auth/lib/roles'
import {
  fetchJoinCode,
  hasLocalData,
  listMembers,
  regenerateJoinCode,
  renameSchool,
  setMemberRole,
  signOut,
  updateDisplayName,
  uploadLocalData,
  type SchoolMember,
} from '@/features/auth/lib/session'
import { canManageSchool, useAuthStore } from '@/stores/authStore'

import { SettingGroup, SettingRow } from '../components/SettingRow'

/** Small "edit and save" text field. */
function InlineEdit({
  id,
  value,
  maxLength,
  onSave,
  disabled = false,
}: {
  id: string
  value: string
  maxLength: number
  onSave: (value: string) => Promise<void>
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const [pending, setPending] = useState(false)
  const changed = draft.trim() !== value && draft.trim() !== ''

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!changed) return
        setPending(true)
        onSave(draft)
          .then(() => toast.success('บันทึกแล้ว'))
          .catch((error: unknown) => toast.error(describeAuthError(error)))
          .finally(() => setPending(false))
      }}
    >
      <Input id={id} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={maxLength} disabled={disabled} />
      <Button type="submit" variant="secondary" disabled={!changed || pending || disabled} className="shrink-0">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        บันทึก
      </Button>
    </form>
  )
}

function JoinCodeRow() {
  const [code, setCode] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  const reveal = () => {
    setPending(true)
    fetchJoinCode()
      .then(setCode)
      .catch((error: unknown) => toast.error(describeAuthError(error)))
      .finally(() => setPending(false))
  }

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      toast.success('คัดลอกรหัสเข้าร่วมแล้ว')
    } catch {
      toast.error('คัดลอกไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด')
    }
  }

  return (
    <SettingRow label="รหัสเข้าร่วม" description="ให้ครูท่านอื่นใช้รหัสนี้เพื่อเข้าร่วมโรงเรียน (เห็นได้เฉพาะเจ้าของและผู้ดูแล)">
      {code ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-xl border border-neon-cyan/40 bg-ink/70 px-3 py-2 font-mono text-lg tracking-[0.3em] text-neon-cyan" data-testid="join-code">
            {code}
          </code>
          <Button variant="secondary" size="icon" onClick={() => void copy()} aria-label="คัดลอกรหัสเข้าร่วม">
            <Copy aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmRegenerate(true)} aria-label="สร้างรหัสใหม่">
            <RefreshCw aria-hidden />
          </Button>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={reveal} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Eye aria-hidden />}
          แสดงรหัสเข้าร่วม
        </Button>
      )}
      <ConfirmDialog
        open={confirmRegenerate}
        onOpenChange={setConfirmRegenerate}
        title="สร้างรหัสเข้าร่วมใหม่?"
        description="รหัสเดิมจะใช้ไม่ได้อีก ครูที่เป็นสมาชิกอยู่แล้วไม่ได้รับผลกระทบ"
        confirmLabel="สร้างรหัสใหม่"
        successMessage="สร้างรหัสเข้าร่วมใหม่แล้ว"
        onConfirm={async () => setCode(await regenerateJoinCode())}
      />
    </SettingRow>
  )
}

function MembersGroup({ isOwner }: { isOwner: boolean }) {
  const profile = useAuthStore((state) => state.profile)
  const [members, setMembers] = useState<SchoolMember[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    listMembers()
      .then(setMembers)
      .catch((error: unknown) => toast.error(describeAuthError(error)))
  }, [])

  useEffect(load, [load])

  const changeRole = (member: SchoolMember) => {
    const next = member.role === 'admin' ? 'teacher' : 'admin'
    setBusyId(member.id)
    setMemberRole(member.id, next)
      .then(() => {
        toast.success(`${member.displayName || 'สมาชิก'} เป็น${ROLE_LABELS[next]}แล้ว`)
        load()
      })
      .catch((error: unknown) => toast.error(describeAuthError(error)))
      .finally(() => setBusyId(null))
  }

  return (
    <SettingGroup title="สมาชิกในโรงเรียน" description="ผู้ดูแลเห็นและจัดการห้องเรียนทุกห้องของโรงเรียนได้">
      {members === null ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground sm:px-6" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          กำลังโหลด…
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {member.displayName || 'ไม่มีชื่อ'}
                  {member.id === profile?.id ? <span className="text-muted-foreground"> (คุณ)</span> : null}
                </p>
                <Badge variant={member.role === 'teacher' ? 'muted' : member.role === 'owner' ? 'gold' : 'cyan'} className="mt-1">
                  {ROLE_LABELS[member.role]}
                </Badge>
              </div>
              {isOwner && member.role !== 'owner' ? (
                <Button variant="secondary" size="sm" disabled={busyId !== null} onClick={() => changeRole(member)}>
                  {busyId === member.id ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                  {member.role === 'admin' ? 'เปลี่ยนเป็นครู' : 'ตั้งเป็นผู้ดูแล'}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SettingGroup>
  )
}

function UploadLocalRow() {
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    hasLocalData()
      .then(setAvailable)
      .catch(() => setAvailable(false))
  }, [])

  return (
    <SettingRow
      label="ย้ายข้อมูลจากเครื่องนี้ขึ้นคลาวด์"
      description={
        available
          ? 'คัดลอกห้องเรียน รายชื่อ และประวัติที่เคยบันทึกไว้ในเบราว์เซอร์นี้ เข้าบัญชีของคุณ'
          : 'ไม่มีข้อมูลในเครื่องนี้ที่ต้องย้าย'
      }
    >
      <Button variant="secondary" className="w-full" disabled={!available} onClick={() => setOpen(true)}>
        <Upload aria-hidden />
        อัปโหลดข้อมูลในเครื่อง
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="อัปโหลดข้อมูลในเครื่องขึ้นคลาวด์?"
        description="ข้อมูลทั้งหมดในเบราว์เซอร์นี้จะถูกคัดลอกเข้าบัญชีของคุณ ข้อมูลในเครื่องยังคงอยู่ และรายการที่เคยอัปโหลดแล้วจะไม่ถูกเพิ่มซ้ำ"
        confirmLabel="อัปโหลด"
        onConfirm={async () => {
          const summary = await uploadLocalData()
          toast.success(`อัปโหลดแล้ว: ${summary.classrooms} ห้อง ${summary.students} คน ${summary.results} ผลการสุ่ม`)
        }}
      />
    </SettingRow>
  )
}

export function AccountSection() {
  const status = useAuthStore((state) => state.status)
  const profile = useAuthStore((state) => state.profile)
  const school = useAuthStore((state) => state.school)

  if (status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-muted-foreground" role="status">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        กำลังตรวจสอบบัญชี…
      </p>
    )
  }

  if (status === 'signed-out' || status === 'disabled') {
    return (
      <SettingGroup title="บัญชีครู" description="ตอนนี้ข้อมูลทั้งหมดถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น">
        <div className="grid gap-4 px-5 py-5 sm:px-6">
          <ul className="grid gap-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Cloud className="size-4 shrink-0 text-neon-cyan" aria-hidden />
              เก็บห้องเรียนและประวัติไว้บนคลาวด์ เปิดได้จากทุกเครื่อง
            </li>
            <li className="flex gap-2">
              <School className="size-4 shrink-0 text-neon-cyan" aria-hidden />
              แยกข้อมูลตามโรงเรียน ครูแต่ละคนเห็นเฉพาะห้องของตัวเอง
            </li>
          </ul>
          {status === 'disabled' ? (
            <p className="text-sm text-muted-foreground">ผู้ดูแลเว็บไซต์ยังไม่ได้เชื่อมต่อฐานข้อมูลออนไลน์</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/login">
                  <LogIn aria-hidden />
                  เข้าสู่ระบบ
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/login?mode=signup">
                  <UserPlus aria-hidden />
                  สมัครสมาชิก
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SettingGroup>
    )
  }

  if (status === 'needs-school' || !profile || !school) {
    return (
      <SettingGroup title="ตั้งค่าโรงเรียน" description="บัญชีนี้ยังไม่ได้อยู่ในโรงเรียนใด">
        <div className="flex flex-wrap gap-2 px-5 py-5 sm:px-6">
          <Button asChild>
            <Link to="/onboarding">
              <School aria-hidden />
              เข้าร่วมหรือสร้างโรงเรียน
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            <LogOut aria-hidden />
            ออกจากระบบ
          </Button>
        </div>
      </SettingGroup>
    )
  }

  const admin = canManageSchool(profile)

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup title="บัญชีของฉัน" description={profile.email}>
        <SettingRow label="ชื่อที่แสดง" description="ชื่อที่เพื่อนครูในโรงเรียนเห็น" htmlFor="account-name">
          <InlineEdit id="account-name" value={profile.displayName} maxLength={60} onSave={updateDisplayName} />
        </SettingRow>
        <SettingRow label="บทบาท" description="สิทธิ์ของคุณในโรงเรียนนี้">
          <Badge variant={profile.role === 'teacher' ? 'muted' : 'gold'}>{ROLE_LABELS[profile.role]}</Badge>
        </SettingRow>
        <SettingRow label="ออกจากระบบ" description="ออกจากระบบเฉพาะเครื่องนี้ ข้อมูลบนคลาวด์ยังอยู่ครบ">
          <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
            <LogOut aria-hidden />
            ออกจากระบบ
          </Button>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="โรงเรียน" description="ข้อมูลของแต่ละโรงเรียนแยกจากกันโดยสมบูรณ์">
        <SettingRow
          label="ชื่อโรงเรียน"
          description={admin ? 'เปลี่ยนได้เฉพาะเจ้าของและผู้ดูแล' : undefined}
          htmlFor="school-name-edit"
        >
          <InlineEdit id="school-name-edit" value={school.name} maxLength={100} onSave={renameSchool} disabled={!admin} />
        </SettingRow>
        {admin ? <JoinCodeRow /> : null}
      </SettingGroup>

      <MembersGroup isOwner={profile.role === 'owner'} />

      <SettingGroup title="ข้อมูล" description="ข้อมูลบนคลาวด์ซิงก์อัตโนมัติทุกครั้งที่บันทึก">
        <UploadLocalRow />
      </SettingGroup>
    </div>
  )
}
