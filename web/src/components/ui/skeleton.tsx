import { cn } from '@/utils/cn';

/**
 * Base skeleton block. Uses the `.skeleton` fade animation from index.css
 * so loading placeholders share the app's visual language.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-md', className)} {...props} />;
}
