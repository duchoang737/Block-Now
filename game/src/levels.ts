import data from './levels.data.json';
import type { Level } from './types';

export const LEVELS: Level[] = data as unknown as Level[];

export const getLevel = (id: string): Level | undefined => LEVELS.find((l) => l.id === id);

export const nextLevel = (id: string): Level | undefined => {
  const idx = LEVELS.findIndex((l) => l.id === id);
  return idx >= 0 ? LEVELS[idx + 1] : undefined;
};
