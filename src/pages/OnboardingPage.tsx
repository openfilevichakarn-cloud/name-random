import { KeyRound, LoaderCircle, LogOut, School } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { describeAuthError } from '@/features/auth/lib/errors'
import { createSchool, joinSchool, signOut } from '@/features/auth/lib/session'
import { fieldAria } from '@/lib/fieldAria'
import { useAuthStore } from '@/stores/authStore'

type Mode = 'join' | 'create'

export default function OnboardingPage() {
  const status = useAuthStore((state) => state.status)
  const profile = useAuthStore((state) => state.profile)
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('join')
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [schoolName, setSchoolName] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'ready' || status === 'disabled') void navigate('/', { replace: true })
    else if (status === 'signed-out') void navigate('/login', { replace: true })
  }, [status, navigate])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'create' && !schoolName.trim()) {
      setError('กรุณากรอกชื่อโรงเรียน')
      return
    }
    if (mode === 'join' && code.replace(/[^A-Za-z0-9]/g, '').length < 6) {
      setError('กรุณากรอกรหัสเข้าร่วม 8 ตัวอักษรที่ได้รับจากผู้ดูแลโรงเรียน')
      return
    }
    setPending(true)
    setError(null)
    try {
      if (mode === 'create') await createSchool(schoolName, displayName)
      else await joinSchool(code, displayName)
      // Status becomes `ready` and the effect above takes the user into the app.
    } catch (cause) {
      setError(describeAuthError(cause))
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="ตั้งค่าโรงเรียนของคุณ"
      description="ข้อมูลของแต่ละโรงเรียนแยกจากกันโดยสมบูรณ์ เข้าร่วมโรงเรียนเดิมด้วยรหัสจากผู้ดูแล หรือสร้างโรงเรียนใหม่"
      footer={
        <Button variant="link" onClick={() => void signOut()}>
          <LogOut aria-hidden />
          ออกจากระบบ
        </Button>
      }
    >
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)} className="gap-5">
          <TabsList>
            <TabsTrigger value="join">
              <KeyRound aria-hidden />
              เข้าร่วมโรงเรียน
            </TabsTrigger>
            <TabsTrigger value="create">
              <School aria-hidden />
              สร้างโรงเรียนใหม่
            </TabsTrigger>
          </TabsList>
          <TabsContent value="join" className="grid gap-4">
            <FormField label="รหัสเข้าร่วม" htmlFor="join-code" hint="ขอรหัสได้จากเจ้าของหรือผู้ดูแลโรงเรียน">
              <Input
                {...fieldAria('join-code', undefined, 'hint')}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                className="font-mono text-lg tracking-[0.3em]"
                placeholder="XXXXXXXX"
              />
            </FormField>
          </TabsContent>
          <TabsContent value="create" className="grid gap-4">
            <FormField label="ชื่อโรงเรียน" htmlFor="school-name" hint="คุณจะเป็นเจ้าของโรงเรียนและเชิญครูท่านอื่นได้">
              <Input
                {...fieldAria('school-name', undefined, 'hint')}
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                maxLength={100}
                autoComplete="organization"
              />
            </FormField>
          </TabsContent>
        </Tabs>
        <div className="mt-4 grid gap-4">
          <FormField label="ชื่อที่แสดง" htmlFor="onboarding-name" hint="ชื่อที่เพื่อนครูในโรงเรียนจะเห็น">
            <Input
              {...fieldAria('onboarding-name', undefined, 'hint')}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={60}
              autoComplete="name"
            />
          </FormField>
          {error ? (
            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            {mode === 'create' ? 'สร้างโรงเรียน' : 'เข้าร่วมโรงเรียน'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
