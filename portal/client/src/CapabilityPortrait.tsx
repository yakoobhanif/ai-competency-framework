import { dimensionColors, profileColors } from './palette';
import { useId, useState, type PointerEvent } from 'react';
import type { Profile } from '../../shared/types';
import './capability-portrait.css';

type Values = (number | null)[];
const names = ['Understand', 'Learn', 'Create', 'Evaluate'];
const accents = [dimensionColors.U, dimensionColors.L, dimensionColors.C, dimensionColors.R];
const origin = { x: 320, y: 280 },
  radius = 188;
const directions = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
function anchor(i: number, value: number) {
  const amount = (Math.max(0, Math.min(100, value)) / 100) * radius;
  return { x: origin.x + directions[i].x * amount, y: origin.y + directions[i].y * amount };
}
function outline(values: Values) {
  const nodes = values.map((value, i) => (value === null ? null : anchor(i, value)));
  const complete = values.every((v) => v !== null);
  let path = '';
  for (let i = 0; i < 4; i++) {
    const a = nodes[i],
      b = nodes[(i + 1) % 4];
    if (!a || !b) continue;
    if (!complete || i === 0) path += `M${a.x},${a.y}`;
    path += `L${b.x},${b.y}`;
  }
  return complete ? path + 'Z' : path;
}

export default function CapabilityPortrait({
  baseline,
  current,
  showSelf,
  color,
  label,
}: {
  baseline: Profile;
  current: Profile;
  showSelf: boolean;
  color: string;
  label: string;
}) {
  const uid = useId().replaceAll(':', '');
  type Series = 'main' | 'baseline' | 'self';
  const [hovered, setHovered] = useState<Series | null>(null);
  const [focused, setFocused] = useState<Series | null>(null);
  const [pinned, setPinned] = useState<Series | null>(null);
  const highlight = hovered ?? focused ?? pinned;
  const hover = (series: Series) => ({
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType !== 'touch') setHovered(series);
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType !== 'touch') setHovered(null);
    },
  });

  const base = baseline.dimensions.map((d) => d.score);
  const active = current.dimensions.map((d) => d.score);
  const self = current.dimensions.map((d) => d.self);
  const overlay = current.id !== 'quiz';
  const complete = (values: Values) => values.every((v) => v !== null);
  const dots = (values: Values, source: string, stroke: string) =>
    values.map((v, i) => {
      if (v === null) return null;
      const p = anchor(i, v);
      return source === 'self' ? (
        <rect
          key={i}
          x={p.x - 4}
          y={p.y - 4}
          width="8"
          height="8"
          fill={stroke}
          stroke="#14171e"
          strokeWidth="1.5"
        />
      ) : (
        <circle
          key={i}
          className={source === 'main' ? 'portrait-anchor' : undefined}
          cx={p.x}
          cy={p.y}
          r="4.5"
          fill={stroke}
          stroke="#14171e"
          strokeWidth="1.5"
        />
      );
    });
  return (
    <div className="capability-portrait" data-highlight={highlight ?? 'none'}>
      <svg
        className="profile-radar portrait-svg"
        viewBox="0 0 640 560"
        role="img"
        aria-labelledby={`${uid}-title ${uid}-description`}
      >
        <title
          id={`${uid}-title`}
        >{`Dimension profile: ${label}${showSelf ? ', with perceived capability' : ''}`}</title>
        <desc id={`${uid}-description`}>
          Four dimensions on a circular guide. Farther from the centre indicates a higher index.
          Select a profile label to highlight it. Performance categories are listed below.
          {showSelf
            ? ' Dashed lines and square markers show self-perception on a separate scale, not a performance score.'
            : ''}{' '}
          Missing dimensions are left open, never plotted as zero.
        </desc>
        <g className="portrait-guides" aria-hidden="true">
          <circle cx={origin.x} cy={origin.y} r={radius} fill="#1b1e26" />
          {[0.25, 0.5, 0.75, 1].map((level) => (
            <circle
              key={level}
              cx={origin.x}
              cy={origin.y}
              r={radius * level}
              fill="none"
              stroke="#a7b0be"
              strokeOpacity={level === 1 ? 0.65 : 0.26}
              strokeWidth={level === 1 ? 1.3 : 1}
            />
          ))}
          {directions.map((d, i) => (
            <line
              key={i}
              x1={origin.x}
              y1={origin.y}
              x2={origin.x + d.x * radius}
              y2={origin.y + d.y * radius}
              stroke="#a7b0be"
              strokeOpacity="0.3"
              strokeWidth="1"
            />
          ))}
        </g>
        {overlay && (
          <g
            className="portrait-baseline portrait-series"
            data-series="baseline"
            {...hover('baseline')}
          >
            <path
              d={outline(base)}
              fill={complete(base) ? profileColors.baseline : 'none'}
              fillOpacity="0.08"
              stroke={profileColors.baseline}
              strokeWidth="2"
              strokeDasharray="3 6"
            />
            {dots(base, 'base', profileColors.baseline)}
          </g>
        )}
        <g className="portrait-main-series portrait-series" data-series="main" {...hover('main')}>
          <path
            className="portrait-main"
            d={outline(active)}
            fill={complete(active) ? color : 'none'}
            fillOpacity="0.26"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {dots(active, 'main', color)}
        </g>
        {showSelf && (
          <g className="portrait-self portrait-series" data-series="self" {...hover('self')}>
            <path
              d={outline(self)}
              fill={complete(self) ? profileColors.self : 'none'}
              fillOpacity="0.08"
              stroke={profileColors.self}
              strokeWidth="2.3"
              strokeDasharray="7 6"
            />
            {dots(self, 'self', profileColors.self)}
          </g>
        )}
        <g className="portrait-axis-labels" textAnchor="middle">
          {[
            { x: 320, y: 60 },
            { x: 562, y: 285 },
            { x: 320, y: 514 },
            { x: 78, y: 285 },
          ].map((p, i) => (
            <text key={names[i]} x={p.x} y={p.y} fill={accents[i]}>
              {names[i]}
            </text>
          ))}
        </g>
      </svg>
      <div className="profile-legend" aria-label="Highlight a profile">
        {[
          { id: 'main' as Series, text: label, color, line: 'solid' },
          ...(overlay
            ? [
                {
                  id: 'baseline' as Series,
                  text: 'Quiz',
                  color: profileColors.baseline,
                  line: 'dotted',
                },
              ]
            : []),
          ...(showSelf
            ? [
                {
                  id: 'self' as Series,
                  text: 'Self-assessment',
                  color: profileColors.self,
                  line: 'dashed',
                },
              ]
            : []),
        ].map((series) => (
          <button
            key={series.id}
            type="button"
            className="portrait-legend-button"
            data-series={series.id}
            aria-label={`Highlight ${series.text}`}
            aria-pressed={pinned === series.id}
            {...hover(series.id)}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) setFocused(series.id);
            }}
            onBlur={() => setFocused(null)}
            onClick={() => setPinned((previous) => (previous === series.id ? null : series.id))}
          >
            <i
              aria-hidden="true"
              style={{
                borderColor: series.color,
                borderTopStyle: series.line as 'solid' | 'dotted' | 'dashed',
              }}
            />
            {series.text}
          </button>
        ))}
      </div>
      <span className="sr-only" role="status">
        {highlight
          ? `${highlight === 'main' ? label : highlight === 'self' ? 'Self-assessment' : 'Quiz'} highlighted`
          : 'All profiles shown'}
      </span>
    </div>
  );
}
