import { LoaderCircle, LogIn, LogOut, School, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Hint } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

import { describeAuthError } from '../lib/errors'
import { ROLE_LABELS } from '../lib/roles'
import { signOut } from '../lib/session'

const triggerClassName = 'size-11 rounded-2xl'

/** Account entry point in the dock: sign in, finish setting up the school, or the account menu. */
export function AccountMenu() {
  const status = useAuthStore((state) => state.status)
  const profile = useAuthStore((state) => state.profile)
  const school = useAuthStore((state) => state.school)
  const navigate = useNavigate()

  if (status === 'disabled') return null

  if (status === 'loading') {
    return (
      <span className={cn('inline-flex items-center justify-center text-muted-foreground', triggerClassName)} role="status">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        <span className="sr-only">กำลังตรวจสอบบัญชี</span>
      </span>
    )
  }

  if (status === 'signed-out') {
    return (
      <Hint label="เข้าสู่ระบบเพื่อซิงก์ข้อมูลขึ้นคลาวด์" side="right">
        <Button variant="ghost" size="icon" className={triggerClassName} asChild>
          <Link to="/login" aria-label="เข้าสู่ระบบ">
            <LogIn aria-hidden />
          </Link>
        </Button>
      </Hint>
    )
  }

  if (status === 'needs-school') {
    return (
      <Hint label="ตั้งค่าโรงเรียนให้เสร็จ" side="right">
        <Button variant="ghost" size="icon" className={cn(triggerClassName, 'relative text-neon-gold')} asChild>
          <Link to="/onboarding" aria-label="ตั้งค่าโรงเรียนให้เสร็จ">
            <School aria-hidden />
            <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-neon-gold" />
          </Link>
        </Button>
      </Hint>
    )
  }

  const name = profile?.displayName || profile?.email || 'บัญชี'
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`บัญชี ${name}`}
          className={cn(
            triggerClassName,
            'inline-flex items-center justify-center bg-[linear-gradient(135deg,var(--neon-cyan),var(--neon-violet))] text-lg font-extrabold text-white',
            'shadow-glow-cyan outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="min-w-64">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{profile?.email}</span>
          <span className="mt-1.5 block truncate text-xs font-normal text-neon-cyan">
            {school?.name} · {profile ? ROLE_LABELS[profile.role] : ''}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate('/settings?tab=account')}>
          <UserRound aria-hidden />
          บัญชีและโรงเรียน
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            signOut()
              .then(() => toast.success('ออกจากระบบแล้ว ตอนนี้ข้อมูลจะเก็บไว้ในเครื่องนี้'))
              .catch((error: unknown) => toast.error(describeAuthError(error)))
          }}
        >
          <LogOut aria-hidden />
          ออกจากระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
