import { Database, Dices, Monitor, Palette, SlidersHorizontal, Sparkles, UserRound, Volume2, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isSupabaseConfigured } from '@/data/supabase/client'
import { AccountSection } from '@/features/settings/sections/AccountSection'
import { AnimationSection } from '@/features/settings/sections/AnimationSection'
import { AppearanceSection } from '@/features/settings/sections/AppearanceSection'
import { DataSection } from '@/features/settings/sections/DataSection'
import { DisplaySection } from '@/features/settings/sections/DisplaySection'
import { GeneralSection } from '@/features/settings/sections/GeneralSection'
import { RulesSection } from '@/features/settings/sections/RulesSection'
import { SoundSection } from '@/features/settings/sections/SoundSection'

interface SettingsTab {
  id: string
  label: string
  icon: LucideIcon
  Component: ComponentType
}

const BASE_TABS: readonly SettingsTab[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal, Component: GeneralSection },
  { id: 'appearance', label: 'Appearance', icon: Palette, Component: AppearanceSection },
  { id: 'sound', label: 'Sound', icon: Volume2, Component: SoundSection },
  { id: 'animation', label: 'Animation', icon: Sparkles, Component: AnimationSection },
  { id: 'rules', label: 'Random Rules', icon: Dices, Component: RulesSection },
  { id: 'data', label: 'Data Management', icon: Database, Component: DataSection },
  { id: 'display', label: 'Display', icon: Monitor, Component: DisplaySection },
]

/** The Account tab only exists when the deployment offers accounts. */
const TABS: readonly SettingsTab[] = isSupabaseConfigured
  ? [...BASE_TABS, { id: 'account', label: 'Account', icon: UserRound, Component: AccountSection }]
  : BASE_TABS

const DEFAULT_TAB = 'general'

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const activeTab = TABS.some((tab) => tab.id === requested) ? (requested as string) : DEFAULT_TAB

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="ตั้งค่า"
        description="ปรับแต่งระบบให้เข้ากับห้องเรียนและอุปกรณ์ของคุณ ทุกการเปลี่ยนแปลงมีผลทันทีและถูกบันทึกอัตโนมัติ"
      />
      <Tabs
        value={activeTab}
        onValueChange={(tab) => setSearchParams({ tab }, { replace: true })}
        className="lg:flex-row lg:items-start lg:gap-8"
        orientation="horizontal"
      >
        <TabsList aria-label="หมวดการตั้งค่า" className="lg:sticky lg:top-10 lg:w-64 lg:shrink-0 lg:flex-col lg:items-stretch">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="shrink-0 lg:justify-start lg:px-4">
              <tab.icon aria-hidden />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-w-0 flex-1">
          {TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <tab.Component />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </>
  )
}
