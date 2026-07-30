import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class strings with last-wins conflict resolution via tailwind-merge. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
