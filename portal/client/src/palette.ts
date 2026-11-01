import type { CSSProperties } from 'react';

// Dimension identity stays outside the red/amber/green assessment scale.
export const dimensionColors = {
  U: '#8fb9ff',
  L: '#7edce8',
  C: '#bda9ff',
  R: '#d0d7e4',
} as const;

// Profiles use neutral tones and line patterns, rather than dimension colours.
export const profileColors = {
  current: '#e5edf8',
  baseline: '#8894a8',
  self: '#bac5d7',
} as const;

export const categoryColors = {
  developing: { color: '#edb4b2', background: '#352327', border: '#664147' },
  established: { color: '#e8cd8e', background: '#332d20', border: '#655535' },
  strong: { color: '#a7dcc0', background: '#20312a', border: '#3e6653' },
} as const;

export const assessmentPalette: CSSProperties = {
  '--dimension-understand': dimensionColors.U,
  '--dimension-learn': dimensionColors.L,
  '--dimension-create': dimensionColors.C,
  '--dimension-evaluate': dimensionColors.R,
  ...Object.fromEntries(
    Object.entries(profileColors).map(([name, value]) => [`--profile-${name}`, value]),
  ),
  ...Object.fromEntries(
    Object.entries(categoryColors).flatMap(([name, values]) =>
      Object.entries(values).map(([role, value]) => [`--category-${name}-${role}`, value]),
    ),
  ),
} as CSSProperties;
