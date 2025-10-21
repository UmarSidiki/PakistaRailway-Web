interface StatusChipProps {
  variant?: 'live' | 'offline' | 'unknown';
  label: string;
}

const variantStyles: Record<NonNullable<StatusChipProps['variant']>, string> = {
  live: 'bg-[#e7f6ef] text-[#2c7f68] border border-[#b9e0d0] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
  offline: 'bg-[#f4e6d6] text-[color:var(--ink-muted)] border border-[#e4d7c5] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
  unknown: 'bg-[#fbead3] text-[#b26b1f] border border-[#e7caa0] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
};

export const StatusChip = ({ variant = 'unknown', label }: StatusChipProps) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${variantStyles[variant]}`}>
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${variant === 'live' ? 'bg-[#2c7f68] animate-pulse' : variant === 'offline' ? 'bg-[#bfa687]' : 'bg-[#c27a2f]'}`} />
    {label}
  </span>
);
