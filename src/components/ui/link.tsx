import { type AnchorHTMLAttributes } from 'react';
import { NavLink, type NavLinkProps } from 'react-router-dom';
import { cn } from '@/utils';

// ── External / plain anchor ────────────────────────────────────────────────────
function Link({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn('transition-colors hover:text-white text-zinc-400', className)}
      {...props}
    />
  );
}

// ── React Router nav link with active state ────────────────────────────────────
function AppNavLink({ className, ...props }: NavLinkProps) {
  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          'transition-colors text-sm font-medium',
          isActive ? 'text-white' : 'text-zinc-400 hover:text-white',
          typeof className === 'function' ? className({ isActive, isPending: false, isTransitioning: false }) : className,
        )
      }
      {...props}
    />
  );
}

export { Link, AppNavLink };
