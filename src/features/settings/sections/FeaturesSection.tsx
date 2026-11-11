import { Flame, Gift, Star, Target, Timer, Trophy, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  ANSWER_TIMER_OPTIONS,
  CHALLENGE_PRESETS,
  REWARD_PRESETS,
  type AnswerTimerSeconds,
  type FeatureSettings,
} from '@/data/settings'
import { cn } from '@/lib/utils'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'

import { ResetButton } from '../components/ResetButton'
import { SettingGroup, SettingRow } from '../components/SettingRow'
import { TextListEditor } from '../components/TextListEditor'

type FeatureToggle = Extract<keyof FeatureSettings, 'stars' | 'streak' | 'quiz' | 'challenge' | 'reward'>

interface FeatureHeaderProps {
  toggle: FeatureToggle
  icon: LucideIcon
  tone: string
  title: string
  description: ReactNode
}

/** One feature: icon, name, what it does, and its on/off switch. */
function FeatureRow({ toggle, icon: Icon, tone, title, description }: FeatureHeaderProps) {
  const features = useSettings('features')
  const update = useSettingsStore((state) => state.update)
  const id = `feature-${toggle}`
  return (
    <div className="flex items-start gap-4 px-5 py-4 sm:px-6">
      <span className={cn('mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border', tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="font-semibold">
          {title}
        </label>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={features[toggle]}
        onCheckedChange={(checked) => update('features', { [toggle]: checked })}
        className="mt-1"
      />
    </div>
  )
}

/** Settings → Features: the classroom game layer on top of the draws. */
export function FeaturesSection() {
  const features = useSettings('features')
  const update = useSettingsStore((state) => state.update)
  const rewardPercent = Math.round(features.rewardChance * 100)

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup
        title="คะแนนและอันดับ"
        description="ให้ดาวนักเรียนบนหน้าผู้ชนะ แล้วดูอันดับดาวสะสมของแต่ละห้อง"
        action={<ResetButton section="features" label="ฟีเจอร์พิเศษ" />}
      >
        <FeatureRow
          toggle="stars"
          icon={Star}
          tone="border-neon-gold/40 bg-neon-gold/10 text-neon-gold"
          title="Class Ranking — ให้ดาว"
          description="ปุ่มให้ดาวบนหน้าผู้ชนะและหน้าสรุปผล ดาวถูกบันทึกในประวัติและนับรวมในหน้าอันดับ"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6">
          <p className="text-sm text-muted-foreground">ดาวที่ให้แล้วยังคงอยู่ แม้ปิดฟีเจอร์นี้ภายหลัง</p>
          <Button asChild variant="ghost" size="sm">
            <Link to="/ranking">
              <Trophy aria-hidden />
              เปิดหน้าอันดับ
            </Link>
          </Button>
        </div>
        <FeatureRow
          toggle="streak"
          icon={Flame}
          tone="border-neon-pink/40 bg-neon-pink/10 text-neon-pink"
          title="Lucky Streak"
          description="แสดงป้ายเมื่อนักเรียนคนเดิมถูกเลือกซ้ำในวันเดียวกัน (ตั้งแต่ครั้งที่ 2) เห็นได้บ่อยเมื่อเปิดกติกา “ซ้ำได้”"
        />
      </SettingGroup>

      <SettingGroup title="Quiz Mode" description="จับเวลาให้ผู้ถูกเลือกตอบคำถาม แล้วบันทึกว่าตอบถูกหรือผิด">
        <FeatureRow
          toggle="quiz"
          icon={Timer}
          tone="border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
          title="ตัวจับเวลาตอบคำถาม"
          description="แสดงบนหน้าผู้ชนะเมื่อสุ่มทีละคน ตอบถูกได้ดาว 1 ดวง (เมื่อเปิดการให้ดาว)"
        />
        <SettingRow label="เวลาตอบ" description="เริ่มนับเมื่อครูกดเริ่มจับเวลา">
          <Select
            value={String(features.answerTimer)}
            onValueChange={(value) => update('features', { answerTimer: Number(value) as AnswerTimerSeconds })}
            disabled={!features.quiz}
          >
            <SelectTrigger aria-label="เวลาตอบ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANSWER_TIMER_OPTIONS.map((seconds) => (
                <SelectItem key={seconds} value={String(seconds)}>
                  {seconds} วินาที
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Random Challenge" description="สุ่มภารกิจให้ผู้ถูกเลือก ภารกิจไม่ซ้ำกันจนกว่าจะใช้ครบทุกข้อ">
        <FeatureRow
          toggle="challenge"
          icon={Target}
          tone="border-neon-violet/50 bg-neon-violet/15 text-neon-violet"
          title="สุ่มภารกิจ"
          description="แสดงการ์ดภารกิจบนหน้าผู้ชนะ ครูกดสุ่มภารกิจใหม่ได้"
        />
        <div className="px-5 py-4 sm:px-6">
          <TextListEditor
            noun="ภารกิจ"
            items={features.challenges}
            onChange={(challenges) => update('features', { challenges })}
            placeholder="เช่น ตอบคำถามข้อถัดไป"
            presets={CHALLENGE_PRESETS}
            emptyText="ยังไม่มีภารกิจ เพิ่มอย่างน้อย 1 ข้อเพื่อใช้ Random Challenge"
          />
        </div>
      </SettingGroup>

      <SettingGroup
        title="Surprise Reward"
        description="ผู้ถูกเลือกมีโอกาสได้รางวัลเซอร์ไพรส์ เปิดกล่องรางวัลบนหน้าผู้ชนะ"
      >
        <FeatureRow
          toggle="reward"
          icon={Gift}
          tone="border-neon-lime/40 bg-neon-lime/10 text-neon-lime"
          title="รางวัลเซอร์ไพรส์"
          description="สุ่มด้วยโอกาสที่กำหนด รางวัลถูกบันทึกในประวัติ"
        />
        <SettingRow label="โอกาสได้รางวัล" description="ต่อผู้ถูกเลือก 1 คน">
          <div className="flex items-center gap-3">
            <Slider
              thumbLabel="โอกาสได้รางวัล"
              value={[rewardPercent]}
              min={0}
              max={100}
              step={5}
              disabled={!features.reward}
              onValueChange={([next]) => update('features', { rewardChance: (next ?? 0) / 100 })}
              className="sm:w-56"
            />
            <span className="tabular w-11 shrink-0 text-right text-sm text-muted-foreground">{rewardPercent}%</span>
          </div>
        </SettingRow>
        <div className="px-5 py-4 sm:px-6">
          <TextListEditor
            noun="รางวัล"
            items={features.rewards}
            onChange={(rewards) => update('features', { rewards })}
            placeholder="เช่น รับสติกเกอร์จากครู"
            presets={REWARD_PRESETS}
            emptyText="ยังไม่มีรางวัล เพิ่มอย่างน้อย 1 รายการเพื่อใช้ Surprise Reward"
          />
        </div>
      </SettingGroup>
    </div>
  )
}
