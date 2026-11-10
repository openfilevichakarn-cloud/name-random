import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useAsyncAction } from '@/hooks/useAsyncAction'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** `destructive` paints the confirm button red (delete, reset). */
  tone?: 'default' | 'destructive'
  /** Toast shown after the action succeeds. */
  successMessage?: string
  /** The dialog stays open (with a spinner) until this resolves, and closes only on success. */
  onConfirm: () => Promise<unknown> | void
}

/** Modal confirmation for irreversible actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'ยกเลิก',
  tone = 'default',
  successMessage,
  onConfirm,
}: ConfirmDialogProps) {
  const { run, pending } = useAsyncAction()

  const handleConfirm = async () => {
    const ok = await run(async () => onConfirm(), { success: successMessage })
    if (ok) onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'default'}
            disabled={pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
