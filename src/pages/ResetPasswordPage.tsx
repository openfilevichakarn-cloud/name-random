import { KeyRound, LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { describeAuthError } from '@/features/auth/lib/errors'
import { updatePassword } from '@/features/auth/lib/session'
import { fieldAria } from '@/lib/fieldAria'
import { useAuthStore } from '@/stores/authStore'

const MIN_PASSWORD = 8

export default function ResetPasswordPage() {
  const status = useAuthStore((state) => state.status)
  const recovering = useAuthStore((state) => state.recovering)
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The reset link signs the user in; without a session the link was invalid or has expired.
  const hasSession = recovering || status === 'ready' || status === 'needs-school'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`)
      return
    }
    if (password !== confirm) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }
    setPending(true)
    setError(null)
    try {
      await updatePassword(password)
      toast.success('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว')
      void navigate('/', { replace: true })
    } catch (cause) {
      setError(describeAuthError(cause))
      setPending(false)
    }
  }

  if (status === 'loading') {
    return (
      <AuthLayout title="ตั้งรหัสผ่านใหม่">
        <p className="flex items-center justify-center gap-2 py-8 text-muted-foreground" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          กำลังตรวจสอบลิงก์…
        </p>
      </AuthLayout>
    )
  }

  if (!hasSession) {
    return (
      <AuthLayout title="ลิงก์ไม่ถูกต้องหรือหมดอายุ">
        <div className="grid gap-4 text-center">
          <p className="text-muted-foreground">กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้งจากหน้าเข้าสู่ระบบ</p>
          <Button asChild>
            <Link to="/login">ไปที่หน้าเข้าสู่ระบบ</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="ตั้งรหัสผ่านใหม่">
      <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
        <FormField label="รหัสผ่านใหม่" htmlFor="new-password" hint={`อย่างน้อย ${MIN_PASSWORD} ตัวอักษร`}>
          <PasswordInput
            {...fieldAria('new-password', undefined, 'hint')}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField label="ยืนยันรหัสผ่านใหม่" htmlFor="confirm-password">
          <PasswordInput
            {...fieldAria('confirm-password')}
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </FormField>
        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
          บันทึกรหัสผ่านใหม่
        </Button>
      </form>
    </AuthLayout>
  )
}
