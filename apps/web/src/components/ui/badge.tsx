import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 rounded text-sm font-semibold tracking-wide uppercase',
  {
    variants: {
      variant: {
        success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        accent: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
)

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
