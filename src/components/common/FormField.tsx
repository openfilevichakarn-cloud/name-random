import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  /** id of the control inside. The error element gets the id `${htmlFor}-error`. */
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: ReactNode
}

/** Label + control + inline error. Pair with `fieldAria()` from `@/lib/fieldAria` on the control. */
export function FormField({ label, htmlFor, error, hint, required = false, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* The asterisk is generated content: it stays out of the accessible name ("required" comes from the input). */}
      <Label htmlFor={htmlFor} className={required ? "gap-1 after:text-neon-pink after:content-['*']" : undefined}>
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
