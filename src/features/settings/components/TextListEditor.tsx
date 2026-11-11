import { ListRestart, Plus, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LIMITS } from '@/data/settings'
import { fieldAria } from '@/lib/fieldAria'

interface TextListEditorProps {
  /** Name of the list, e.g. "ภารกิจ". Used in labels and messages. */
  noun: string
  items: readonly string[]
  onChange: (items: string[]) => void
  placeholder: string
  /** What "ใช้ชุดตัวอย่าง" restores. */
  presets: readonly string[]
  /** Shown while the list is empty. */
  emptyText: string
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Edit a short list of phrases (missions, rewards). Validation mirrors `sanitizeSettings`:
 * trimmed, non-empty, unique ignoring case, at most `LIMITS.listItems` items.
 */
export function TextListEditor({ noun, items, onChange, placeholder, presets, emptyText }: TextListEditorProps) {
  const inputId = useId()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | undefined>()
  const full = items.length >= LIMITS.listItems

  const add = (event: FormEvent) => {
    event.preventDefault()
    const text = normalize(draft)
    if (!text) {
      setError(`พิมพ์${noun}ก่อนกดเพิ่ม`)
      return
    }
    if (items.some((item) => item.toLocaleLowerCase() === text.toLocaleLowerCase())) {
      setError(`มี${noun}นี้อยู่ในรายการแล้ว`)
      return
    }
    onChange([...items, text])
    setDraft('')
    setError(undefined)
  }

  const remove = (index: number) => {
    const removed = items[index]
    if (removed === undefined) return
    const previous = [...items]
    onChange(items.filter((_, position) => position !== index))
    toast.success(`ลบ “${removed}” แล้ว`, { action: { label: 'เลิกทำ', onClick: () => onChange(previous) } })
  }

  const restorePresets = () => {
    const previous = [...items]
    onChange([...presets])
    setError(undefined)
    toast.success(`ใช้${noun}ชุดตัวอย่างแล้ว`, { action: { label: 'เลิกทำ', onClick: () => onChange(previous) } })
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 ? (
        <ol className="flex flex-col gap-1.5" aria-label={`รายการ${noun}`}>
          {items.map((item, index) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-xl border border-border bg-ink/40 py-1.5 pr-1.5 pl-3"
            >
              <span className="tabular w-5 shrink-0 text-right text-xs text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 break-words">{item}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`ลบ “${item}”`} onClick={() => remove(index)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}

      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-start" noValidate>
        <FormField
          label={`เพิ่ม${noun}`}
          htmlFor={inputId}
          error={error}
          hint={full ? `ครบ ${LIMITS.listItems} รายการแล้ว ลบบางรายการก่อนเพิ่มใหม่` : undefined}
          className="flex-1 [&>label]:sr-only"
        >
          <Input
            {...fieldAria(inputId, error, full ? 'full' : undefined)}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              if (error) setError(undefined)
            }}
            placeholder={placeholder}
            maxLength={LIMITS.listItemLength}
            disabled={full}
            autoComplete="off"
          />
        </FormField>
        <Button type="submit" variant="secondary" disabled={full} className="shrink-0">
          <Plus aria-hidden />
          เพิ่ม
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="tabular">
          {items.length} / {LIMITS.listItems} รายการ
        </span>
        <Button variant="ghost" size="sm" onClick={restorePresets}>
          <ListRestart aria-hidden />
          ใช้ชุดตัวอย่าง
        </Button>
      </div>
    </div>
  )
}
