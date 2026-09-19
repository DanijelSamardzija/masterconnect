'use client';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function TimePicker24h({ value, onChange, className = '' }: Props) {
  const [hh, mm] = (value || '00:00').split(':');
  const hour = (hh ?? '00').padStart(2, '0');
  const min = (mm ?? '00').slice(0, 2).padStart(2, '0');

  const selectCls = 'bg-transparent border-0 outline-none text-inherit cursor-pointer';

  return (
    <div className={`inline-flex items-center ${className}`}>
      <select value={hour} onChange={e => onChange(`${e.target.value}:${min}`)} className={selectCls}>
        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="select-none mx-px">:</span>
      <select value={min} onChange={e => onChange(`${hour}:${e.target.value}`)} className={selectCls}>
        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}
