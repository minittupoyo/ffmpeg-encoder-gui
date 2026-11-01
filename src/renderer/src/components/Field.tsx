import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

export function Field({
  label,
  children,
  hint
}: {
  label: string
  children: ReactNode
  hint?: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}
