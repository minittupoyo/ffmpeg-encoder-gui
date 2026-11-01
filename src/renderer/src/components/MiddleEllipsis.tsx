import { cn } from '@/lib/utils'

/** 先頭側だけを「…」で省略し、末尾(拡張子など)は常に表示するテキスト */
export function MiddleEllipsis({
  head,
  tail,
  className
}: {
  head: string
  tail: string
  className?: string
}): React.JSX.Element {
  return (
    <span className={cn('flex min-w-0', className)}>
      <span className="truncate">{head}</span>
      {tail && <span className="shrink-0 whitespace-pre">{tail}</span>}
    </span>
  )
}
