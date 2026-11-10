import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Extra text for screen readers / tooltips when the label is an icon. */
  ariaLabel?: string
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentOption<T>[]
  /** Accessible name of the whole group. */
  label: string
  size?: 'sm' | 'default'
  disabled?: boolean
  className?: string
}

/**
 * Single-choice segmented control built on Radix ToggleGroup.
 * Unlike a raw ToggleGroup it never allows the "nothing selected" state.
 */
function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  size = 'default',
  disabled,
  className,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      aria-label={label}
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onValueChange(next as T)
      }}
      className={cn(
        'inline-flex w-full items-stretch gap-1 rounded-xl border border-border bg-ink/60 p-1',
        disabled && 'opacity-50',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          disabled={option.disabled}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 font-semibold text-muted-foreground',
            'transition-colors duration-150 outline-none hover:text-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
            'data-[state=on]:bg-primary/25 data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_60%,transparent)]',
            '[&_svg]:size-4 [&_svg]:shrink-0',
            size === 'sm' ? 'min-h-8 text-xs' : 'min-h-10 text-sm',
          )}
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

export { SegmentedControl }
