import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const fieldClassName = [
  'w-full min-w-0 rounded-xl border border-input bg-ink/60 px-3.5 text-[0.95rem] text-foreground',
  'placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] duration-200',
  'outline-none focus-visible:border-neon-cyan focus-visible:ring-2 focus-visible:ring-neon-cyan/30',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25',
].join(' ')

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClassName,
        'h-11 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClassName, 'min-h-24 py-2.5 leading-relaxed', className)}
      {...props}
    />
  )
}

export { Input, Textarea }
