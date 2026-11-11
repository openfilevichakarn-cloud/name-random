import { ArrowLeft, CloudOff, LoaderCircle, LogIn, MailCheck, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { describeAuthError } from '@/features/auth/lib/errors'
import { requestPasswordReset, signIn, signUp } from '@/features/auth/lib/session'
import { fieldAria } from '@/lib/fieldAria'
import { useAuthStore } from '@/stores/authStore'

const MIN_PASSWORD = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Panel = 'signin' | 'signup' | 'reset'

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}

function SignInForm({ onForgot }: { onForgot: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim()) || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }
    setPending(true)
    setError(null)
    try {
      await signIn(email, password)
      // The page follows the account status (see LoginPage) once the session is active.
    } catch (cause) {
      setError(describeAuthError(cause))
      setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
      <FormField label="อีเมล" htmlFor="signin-email">
        <Input
          {...fieldAria('signin-email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </FormField>
      <FormField label="รหัสผ่าน" htmlFor="signin-password">
        <PasswordInput
          {...fieldAria('signin-password')}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </FormField>
      <ErrorNote message={error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        เข้าสู่ระบบ
      </Button>
      <Button type="button" variant="link" className="justify-self-center" onClick={() => onForgot(email)}>
        ลืมรหัสผ่าน?
      </Button>
    </form>
  )
}

function SignUpForm({ onRegistered }: { onRegistered: (email: string) => void }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Partial<Record<'displayName' | 'email' | 'password' | 'confirm', string>>>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!displayName.trim()) next.displayName = 'กรุณากรอกชื่อที่แสดง'
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    if (password.length < MIN_PASSWORD) next.password = `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`
    if (confirm !== password) next.confirm = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setPending(true)
    setError(null)
    try {
      const { needsConfirmation } = await signUp(email, password, displayName)
      if (needsConfirmation) onRegistered(email.trim())
    } catch (cause) {
      setError(describeAuthError(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
      <FormField label="ชื่อที่แสดง" htmlFor="signup-name" error={errors.displayName} hint="เช่น ครูฟ้า">
        <Input
          {...fieldAria('signup-name', errors.displayName, 'hint')}
          autoComplete="name"
          maxLength={60}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </FormField>
      <FormField label="อีเมล" htmlFor="signup-email" error={errors.email}>
        <Input
          {...fieldAria('signup-email', errors.email)}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </FormField>
      <FormField label="รหัสผ่าน" htmlFor="signup-password" error={errors.password} hint={`อย่างน้อย ${MIN_PASSWORD} ตัวอักษร`}>
        <PasswordInput
          {...fieldAria('signup-password', errors.password, 'hint')}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </FormField>
      <FormField label="ยืนยันรหัสผ่าน" htmlFor="signup-confirm" error={errors.confirm}>
        <PasswordInput
          {...fieldAria('signup-confirm', errors.confirm)}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
      </FormField>
      <ErrorNote message={error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
        สมัครสมาชิก
      </Button>
    </form>
  )
}

function ResetRequestForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('รูปแบบอีเมลไม่ถูกต้อง')
      return
    }
    setPending(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (cause) {
      setError(describeAuthError(cause))
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div className="grid gap-4 text-center" role="status">
        <MailCheck className="mx-auto size-10 text-neon-lime" aria-hidden />
        <p>
          หากมีบัญชีที่ใช้อีเมล <strong className="break-all">{email.trim()}</strong> ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ให้แล้ว
        </p>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft aria-hidden />
          กลับไปเข้าสู่ระบบ
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
      <p className="text-sm text-muted-foreground">กรอกอีเมลของบัญชี ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้</p>
      <FormField label="อีเมล" htmlFor="reset-email">
        <Input
          {...fieldAria('reset-email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </FormField>
      <ErrorNote message={error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        ส่งลิงก์ตั้งรหัสผ่านใหม่
      </Button>
      <Button type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft aria-hidden />
        กลับไปเข้าสู่ระบบ
      </Button>
    </form>
  )
}

export default function LoginPage() {
  const status = useAuthStore((state) => state.status)
  const accountError = useAuthStore((state) => state.error)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [panel, setPanel] = useState<Panel>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin')
  const [resetEmail, setResetEmail] = useState('')
  const [registered, setRegistered] = useState<string | null>(null)

  // Follow the account: a fresh session goes on to onboarding or straight back into the app.
  useEffect(() => {
    if (status === 'ready') void navigate('/', { replace: true })
    else if (status === 'needs-school') void navigate('/onboarding', { replace: true })
  }, [status, navigate])

  if (status === 'disabled') {
    return (
      <AuthLayout title="ระบบบัญชียังไม่เปิดใช้งาน">
        <div className="grid gap-4 text-center">
          <CloudOff className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            เว็บไซต์นี้ยังไม่ได้เชื่อมต่อฐานข้อมูลออนไลน์ คุณยังใช้งานได้ครบทุกฟีเจอร์ โดยข้อมูลจะถูกเก็บไว้ในเบราว์เซอร์นี้
          </p>
          <Button asChild>
            <Link to="/">กลับหน้าหลัก</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (registered) {
    return (
      <AuthLayout title="ตรวจสอบอีเมลของคุณ">
        <div className="grid gap-4 text-center" role="status">
          <MailCheck className="mx-auto size-10 text-neon-lime" aria-hidden />
          <p>
            ระบบส่งลิงก์ยืนยันไปที่ <strong className="break-all">{registered}</strong> แล้ว
            กดลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชี แล้วกลับมาเข้าสู่ระบบอีกครั้ง
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setRegistered(null)
              setPanel('signin')
            }}
          >
            ไปที่หน้าเข้าสู่ระบบ
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={panel === 'reset' ? 'ลืมรหัสผ่าน' : 'บัญชีครู'}
      description={
        panel === 'reset'
          ? undefined
          : 'เข้าสู่ระบบเพื่อเก็บห้องเรียนและประวัติไว้บนคลาวด์ ใช้ได้ทุกเครื่อง และแยกข้อมูลตามโรงเรียน'
      }
      footer={
        <Link to="/" className="rounded-md underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          ใช้งานต่อโดยไม่เข้าสู่ระบบ (เก็บข้อมูลในเครื่องนี้)
        </Link>
      }
    >
      {accountError && status === 'signed-out' ? (
        <div className="mb-4">
          <ErrorNote message={accountError} />
        </div>
      ) : null}
      {status === 'loading' ? (
        <p className="flex items-center justify-center gap-2 py-8 text-muted-foreground" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          กำลังตรวจสอบบัญชี…
        </p>
      ) : panel === 'reset' ? (
        <ResetRequestForm initialEmail={resetEmail} onBack={() => setPanel('signin')} />
      ) : (
        <Tabs value={panel} onValueChange={(value) => setPanel(value as Panel)} className="gap-5">
          <TabsList>
            <TabsTrigger value="signin">เข้าสู่ระบบ</TabsTrigger>
            <TabsTrigger value="signup">สมัครสมาชิก</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignInForm
              onForgot={(email) => {
                setResetEmail(email)
                setPanel('reset')
              }}
            />
          </TabsContent>
          <TabsContent value="signup">
            <SignUpForm onRegistered={setRegistered} />
          </TabsContent>
        </Tabs>
      )}
    </AuthLayout>
  )
}
