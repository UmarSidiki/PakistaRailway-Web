import type { ChangeEvent } from 'react';
import type { TrainFilters } from '@/types';

interface FiltersBarProps {
  filters: TrainFilters;
  onChange: (patch: Partial<TrainFilters>) => void;
}

export const FiltersBar = ({ filters, onChange }: FiltersBarProps) => {
  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ search: event.target.value });
  };

  const handleOnlyLive = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ onlyLive: event.target.checked });
  };

  const handleOnlyPassenger = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ onlyPassenger: event.target.checked });
  };

  const handleDirection = (value: TrainFilters['direction']) => {
    onChange({ direction: value });
  };

  return (
  <div className="rounded-3xl border border-[color:var(--stroke)] bg-[#fffaf3]/80 p-5 shadow-[0_26px_40px_-36px_rgba(95,75,60,0.5)] backdrop-blur">
      {/* Search Input */}
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-3 rounded-2xl border border-[#e5dccd] bg-[#fff3e0] px-4 py-3 shadow-inner focus-within:border-[#2c7f68] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#cde5db] transition-all">
          <svg className="h-5 w-5 text-[#2c7f68]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A6.5 6.5 0 1110.5 4a6.5 6.5 0 016.15 8.65z" />
          </svg>
          <input
            type="search"
            value={filters.search}
            onChange={handleSearch}
            placeholder="Search trains by name or number"
            className="flex-1 bg-transparent text-base text-[color:var(--ink-strong)] outline-none placeholder:text-[color:var(--ink-muted)]"
          />
        </label>

        {/* Filter Options */}
        <div className="flex flex-wrap items-center gap-3">
          {(
            [
              {
                label: 'Live only',
                checked: filters.onlyLive,
                onChange: handleOnlyLive,
              },
              {
                label: 'Passenger',
                checked: filters.onlyPassenger,
                onChange: handleOnlyPassenger,
              },
            ] as const
          ).map(({ label, checked, onChange }) => (
            <label
              key={label}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm shadow-sm transition-all ${
                checked
                  ? 'border-[#2c7f68] bg-[#e7f6ef] text-[#2c7f68] shadow-[0_14px_24px_-18px_rgba(44,127,104,0.35)]'
                  : 'border-[#e4d7c5] bg-white text-[color:var(--ink-muted)] hover:border-[#d8c8b4]'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 rounded border-[#c6b59f] text-[#2c7f68] focus:ring-[#2c7f68]"
              />
              <span className="font-medium">{label}</span>
            </label>
          ))}

          {/* Direction Toggle */}
          <div className="ml-auto flex items-center gap-2 rounded-full border border-[#e4d7c5] bg-white p-1 shadow-sm">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'up', label: 'Northbound' },
                { key: 'down', label: 'Southbound' },
              ] as const
            ).map(({ key, label }) => {
              const isActive = filters.direction === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDirection(key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#2c7f68] text-white shadow-[0_16px_28px_-18px_rgba(44,127,104,0.5)]'
                      : 'bg-transparent text-[color:var(--ink-muted)] hover:bg-[#f1e6d9]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

