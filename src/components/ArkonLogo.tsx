import { cn } from '@/lib/utils';

interface ArkonLogoProps {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  variant?: 'full' | 'mark';
}

export function ArkonLogo({ className, size = 36, withWordmark = false, variant = 'mark' }: ArkonLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src="/756132783_2274483666620765_5282871515405515489_n.jpg"
        alt="ARKON"
        width={size}
        height={size}
        className="shrink-0 rounded-lg object-cover"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <div className="leading-none">
          <span className="font-display text-lg font-700 tracking-tight text-slate-900">ARKON</span>
          {variant === 'full' && (
            <span className="block text-[10px] font-500 uppercase tracking-[0.2em] text-brand-500">
              Facility Management
            </span>
          )}
        </div>
      )}
    </div>
  );
}
