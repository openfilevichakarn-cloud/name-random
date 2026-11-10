import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createToken } from '@/lib/id'
import { cn } from '@/lib/utils'

import { AVATAR_EMOJIS, encodeAvatar, parseAvatar } from '../lib/avatar'

const BOT_OPTIONS = 12

function rollSeeds(keep?: string): string[] {
  const seeds = Array.from({ length: BOT_OPTIONS }, () => createToken(8))
  if (keep) seeds[0] = keep
  return seeds
}

const optionClassName = cn(
  'rounded-2xl p-1 outline-none transition-transform hover:scale-110',
  'focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-neon-cyan/20 aria-pressed:ring-2 aria-pressed:ring-neon-cyan',
)

interface AvatarPickerProps {
  /** Encoded avatar string. */
  value: string
  /** Fallback seed for rendering when `value` is empty. */
  seed: string
  onChange: (avatar: string) => void
}

/** Avatar preview that opens a picker with generated robots and emoji. */
export function AvatarPicker({ value, seed, onChange }: AvatarPickerProps) {
  const current = parseAvatar(value, seed)
  const [open, setOpen] = useState(false)
  const [seeds, setSeeds] = useState(() => rollSeeds(current.kind === 'bot' ? current.seed : undefined))

  const choose = (avatar: string) => {
    onChange(avatar)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="เปลี่ยน Avatar"
          className="group relative shrink-0 rounded-[28%] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
        >
          <StudentAvatar avatar={value} seed={seed} className="size-20" />
          <span className="absolute inset-x-0 bottom-0 rounded-b-[28%] bg-ink/75 py-0.5 text-center text-[0.6875rem] font-semibold text-neon-cyan">
            เปลี่ยน
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[21rem]">
        <Tabs defaultValue={current.kind} className="gap-3">
          <TabsList>
            <TabsTrigger value="bot">โรบอต</TabsTrigger>
            <TabsTrigger value="emoji">อีโมจิ</TabsTrigger>
          </TabsList>
          <TabsContent value="bot" className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-1.5">
              {seeds.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`โรบอตแบบที่ ${index + 1}`}
                  aria-pressed={current.kind === 'bot' && current.seed === option}
                  onClick={() => choose(encodeAvatar({ kind: 'bot', seed: option }))}
                  className={optionClassName}
                >
                  <StudentAvatar avatar={`bot:${option}`} seed={option} className="size-16" />
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSeeds(rollSeeds(current.kind === 'bot' ? current.seed : undefined))}
            >
              <RefreshCw aria-hidden />
              สุ่มชุดใหม่
            </Button>
          </TabsContent>
          <TabsContent value="emoji">
            <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto pr-1">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`อีโมจิ ${emoji}`}
                  aria-pressed={current.kind === 'emoji' && current.emoji === emoji}
                  onClick={() => choose(encodeAvatar({ kind: 'emoji', emoji }))}
                  className={optionClassName}
                >
                  <StudentAvatar avatar={`emoji:${emoji}`} seed={emoji} className="size-10" />
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
