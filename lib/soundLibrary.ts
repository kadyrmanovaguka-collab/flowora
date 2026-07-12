export interface SoundTrack {
  id: string;
  name: string;
  category: "lofi";
  // Файлы должны лежать в /public/sounds/ под этими именами — см. ниже,
  // куда конкретно класть скачанные .mp3.
  src: string;
}

export const SOUND_LIBRARY: SoundTrack[] = [
  { id: "lofi-1", name: "Lo-Fi Study Beat", category: "lofi", src: "/sounds/lofi-1.mp3" },
  { id: "lofi-2", name: "Chill Lo-Fi Loop", category: "lofi", src: "/sounds/lofi-2.mp3" },
  { id: "lofi-3", name: "Rainy Lo-Fi Cafe", category: "lofi", src: "/sounds/lofi-3.mp3" },
  { id: "lofi-4", name: "Late Night Lo-Fi", category: "lofi", src: "/sounds/lofi-4.mp3" },
  { id: "lofi-5", name: "Lo-Fi Piano Loop", category: "lofi", src: "/sounds/lofi-5.mp3" },
];

export const SOUND_CATEGORY_LABELS: Record<SoundTrack["category"], string> = {
  lofi: "Lo-Fi",
};
