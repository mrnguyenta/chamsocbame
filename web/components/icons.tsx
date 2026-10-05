// Biểu tượng nét mảnh (stroke) dùng chung, kế thừa màu chữ.
type P = { size?: number; className?: string };

function S({ size = 20, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {children}
    </svg>
  );
}

export const IconHeart = (p: P) => <S {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></S>;
export const IconPulse = (p: P) => <S {...p}><path d="M3 12h4l3-8 4 16 3-8h4" /></S>;
export const IconSteps = (p: P) => <S {...p}><path d="M8 4c1.7 0 3 1.8 3 4.5S9.7 13 8 13 5 11.2 5 8.5 6.3 4 8 4z" /><path d="M6 16h4v2a2 2 0 0 1-4 0z" /><path d="M16 8c1.7 0 3 1.8 3 4.5S17.7 17 16 17s-3-1.8-3-4.5S14.3 8 16 8z" /><path d="M14 20h4" /></S>;
export const IconMoon = (p: P) => <S {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></S>;
export const IconBolt = (p: P) => <S {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9z" /></S>;
export const IconDrop = (p: P) => <S {...p}><path d="M12 2.7s-6 6.6-6 11.3a6 6 0 0 0 12 0c0-4.7-6-11.3-6-11.3z" /></S>;
export const IconPill = (p: P) => <S {...p}><path d="M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7z" /><path d="m8.5 8.5 7 7" /></S>;
export const IconBell = (p: P) => <S {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></S>;
export const IconWatch = (p: P) => <S {...p}><rect x="6" y="6" width="12" height="12" rx="3" /><path d="M9 6V3h6v3M9 18v3h6v-3M12 10v2l1.5 1.5" /></S>;
export const IconChart = (p: P) => <S {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></S>;
export const IconHome = (p: P) => <S {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></S>;
export const IconGear = (p: P) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></S>;
export const IconPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconChevron = (p: P) => <S {...p}><path d="m9 18 6-6-6-6" /></S>;
export const IconBack = (p: P) => <S {...p}><path d="m15 18-6-6 6-6" /></S>;
export const IconArrow = (p: P) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>;
export const IconUsers = (p: P) => <S {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></S>;
export const IconAlert = (p: P) => <S {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></S>;
export const IconFile = (p: P) => <S {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></S>;
export const IconTelegram = (p: P) => <S {...p}><path d="m22 3-20 8 7 2 2 7 4-5 5 4z" /><path d="m9 13 6-4" /></S>;

/** Trái tim đặc có chuyển màu, dùng làm điểm nhấn như ảnh 3D trong mẫu. */
export function HeartArt({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id="hg" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff9a8a" />
          <stop offset="55%" stopColor="#ef5a4b" />
          <stop offset="100%" stopColor="#c7392c" />
        </radialGradient>
      </defs>
      <path d="M32 56S6 40.5 6 22.5A13.5 13.5 0 0 1 32 15a13.5 13.5 0 0 1 26 7.5C58 40.5 32 56 32 56z" fill="url(#hg)" />
      <ellipse cx="20" cy="21" rx="6" ry="3.5" fill="#fff" opacity=".35" transform="rotate(-30 20 21)" />
    </svg>
  );
}
