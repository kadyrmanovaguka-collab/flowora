import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Стандартный хелпер shadcn/ui: clsx собирает условные классы,
// twMerge разрешает конфликты Tailwind-классов (например "p-2 p-4" → "p-4"),
// что важно, когда компонент принимает className-проп поверх своих дефолтов.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
