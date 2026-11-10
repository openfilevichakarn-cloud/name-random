import { motion } from 'framer-motion'

interface ReadyBannerProps {
  /** Shorter, calmer entrance on the Low animation level. */
  reduced: boolean
}

/** Step 2 of the reveal sequence: a beat of "READY" before anything starts moving. */
export function ReadyBanner({ reduced }: ReadyBannerProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-ink/55"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      aria-hidden
    >
      <motion.p
        className="text-gradient text-[clamp(3rem,22cqmin,11rem)] leading-none font-extrabold tracking-[0.12em]"
        initial={reduced ? { opacity: 0 } : { scale: 2.4, opacity: 0, filter: 'blur(12px)' }}
        animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, filter: 'blur(0px)' }}
        transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 20 }}
      >
        READY
      </motion.p>
    </motion.div>
  )
}
