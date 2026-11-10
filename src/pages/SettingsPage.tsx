import { Palette, Sparkles, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnimationSection } from '@/features/settings/sections/AnimationSection'
import { AppearanceSection } from '@/features/settings/sections/AppearanceSection'

interface SettingsTab {
  id: string
  label: string
  icon: LucideIcon
  Component: ComponentType
}

const TABS: readonly SettingsTab[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette, Component: AppearanceSection },
  { id: 'animation', label: 'Animation', icon: Sparkles, Component: AnimationSection },
]

const DEFAULT_TAB = 'appearance'

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
        <TabsList aria-label="หมวดการตั้งค่า" className="lg:sticky lg:top-10 lg:w-60 lg:shrink-0 lg:flex-col lg:items-stretch">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="lg:justify-start lg:px-4">
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
