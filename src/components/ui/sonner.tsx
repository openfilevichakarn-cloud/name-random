import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** App-wide toast host, themed to match the glass surfaces. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      richColors={false}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'glass-strong !rounded-2xl !border-border !bg-popover !text-foreground !font-sans !shadow-panel !text-[0.95rem]',
          description: '!text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground !rounded-lg !font-semibold',
          cancelButton: '!bg-secondary !text-foreground !rounded-lg',
          closeButton: '!bg-popover !border-border !text-muted-foreground',
          success: '[&_[data-icon]]:!text-neon-lime',
          error: '[&_[data-icon]]:!text-destructive',
          warning: '[&_[data-icon]]:!text-neon-gold',
          info: '[&_[data-icon]]:!text-neon-cyan',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
