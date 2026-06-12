import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';

interface EmptyProps {
  icon?: string
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function Empty({
  icon = '🎬',
  title,
  message,
  actionLabel,
  onAction,
  className,
}: EmptyProps) {
  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center py-24 px-6 text-center', className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="text-7xl mb-6 select-none"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
      >
        {icon}
      </motion.div>

      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">{message}</p>

      {actionLabel && onAction && (
        <motion.button
          className={cn(buttonVariants({ variant: 'primary' }), 'mt-6 rounded-xl text-sm px-6 py-2.5 hover:bg-orange-400 shadow-none')}
          onClick={onAction}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
