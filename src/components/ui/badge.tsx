import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-white/10 text-zinc-300 border-white/15',
        orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        series: 'bg-white/10 text-zinc-300 border-white/15',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
