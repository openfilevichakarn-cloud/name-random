import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { describeError } from '@/data/repository'

interface RunOptions {
  /** Toast shown when the action resolves. */
  success?: string
  /** Prefix of the toast shown when the action rejects. */
  error?: string
}

/**
 * Run an async action with a pending flag and error toast.
 * `run` resolves to `true` on success and `false` on failure, and ignores re-entrant calls.
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async (action: () => Promise<unknown>, options: RunOptions = {}): Promise<boolean> => {
    if (busy.current) return false
    busy.current = true
    setPending(true)
    try {
      await action()
      if (options.success) toast.success(options.success)
      return true
    } catch (error) {
      console.error(error)
      toast.error(describeError(error, options.error))
      return false
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }, [])

  return { run, pending }
}
