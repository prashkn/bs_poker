import { Toaster as Sonner } from "sonner"

function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(0 0% 14.9%)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
