import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

// shadcn-style Select built on @radix-ui/react-select, themed for NiceFilm's
// dark palette. See https://ui.shadcn.com/docs/components/radix/select

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = 'default',
  icon,
  iconOnly,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default';
  /** Optional leading icon rendered inside the trigger. */
  icon?: React.ReactNode;
  /** Icon-only mode: renders a square icon button with no text or chevron. */
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        className={cn(
          'w-9 h-9 flex items-center justify-center rounded-full border border-white/12 bg-white/8 text-zinc-200 cursor-pointer transition-all outline-none',
          'hover:text-white hover:bg-white/12 hover:border-white/20',
          'focus-visible:border-orange-500/60 focus-visible:ring-2 focus-visible:ring-orange-500/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&_svg]:pointer-events-none [&_svg]:shrink-0',
          className,
        )}
        {...props}
      >
        {icon}
        <span className="sr-only">{children}</span>
      </SelectPrimitive.Trigger>
    );
  }

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex w-fit items-center justify-between gap-2 rounded-full border border-white/12 bg-white/8 px-3.5 text-sm font-medium text-white whitespace-nowrap cursor-pointer transition-all outline-none',
        'hover:bg-white/12 hover:border-white/20 focus-visible:border-orange-500/60 focus-visible:ring-2 focus-visible:ring-orange-500/30',
        'disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-white/50',
        'data-[size=default]:h-9 data-[size=sm]:h-8',
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5',
        className,
      )}
      {...props}
    >
      {icon && <span className="text-white/50 flex items-center">{icon}</span>}
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-3.5 text-white/40" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = 'popper',
  align = 'start',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          'bg-[rgba(17,17,17,0.7)] backdrop-blur-[20px] relative z-50 max-h-(--radix-select-content-available-height) origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border border-white/10 text-white shadow-xl',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          position === 'popper' &&
            'min-w-(--radix-select-trigger-width) data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full scroll-my-1',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('px-2 py-1.5 text-xs text-white/50', className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  indicator,
  trailing,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  /** Overrides the default check shown on the selected item. */
  indicator?: React.ReactNode;
  /** Marker shown on the right while the item is NOT selected (e.g. "watched"). */
  trailing?: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'group relative flex w-full cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm text-white/80 outline-hidden select-none',
        'focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white',
        'data-[state=checked]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        className,
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        {trailing && <span className="group-data-[state=checked]:hidden">{trailing}</span>}
        <SelectPrimitive.ItemIndicator>
          {indicator ?? <CheckIcon className="size-4 text-orange-400" />}
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-white/10', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1 text-white/50', className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-1 text-white/50', className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

// ─── Convenience wrapper ─────────────────────────────────────────────────────
// Most call sites just need an icon + a flat list of options; this composes the
// primitives above so those sites stay terse while still being a real Radix Select.

interface SelectFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { id: string; label: string; trailing?: React.ReactNode }[];
  icon?: React.ReactNode;
  /** Overrides the default check shown on the selected option. */
  indicatorIcon?: React.ReactNode;
  placeholder?: string;
  /** Visible field label rendered above the trigger. */
  label?: string;
  /** Fixed, narrow trigger width — handy in toolbars. */
  compact?: boolean;
  /** Icon-only mode: renders a square icon button with no text or chevron. */
  iconOnly?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  triggerClassName?: string;
  /** Extra classes for the dropdown popup panel (SelectContent). */
  contentClassName?: string;
}

function SelectField({
  value,
  onValueChange,
  options,
  icon,
  indicatorIcon,
  placeholder,
  label,
  compact,
  iconOnly,
  size,
  className,
  triggerClassName,
  contentClassName,
}: SelectFieldProps) {
  return (
    <div className={cn(label ? 'space-y-1.5' : undefined, className)}>
      {label && <span className="block text-xs text-white/60 font-medium">{label}</span>}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          icon={icon}
          size={size}
          iconOnly={iconOnly}
          className={cn(compact && 'w-32', label && 'w-full', triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id} indicator={indicatorIcon} trailing={o.trailing}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export {
  Select,
  SelectContent,
  SelectField,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
