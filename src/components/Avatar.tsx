/**
 * أفاتار بالأحرف الأولى من الاسم + لون ثابت لكل اسم (hash-based).
 * يمنح قسم الأشخاص مظهرًا بصريًا احترافيًا بدل قائمة نصية.
 */

// لوحة ألوان هادئة متناسقة مع الهوية (emerald-centric)
const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-lime-500',
];

/** ينتج لونًا ثابتًا لكل نص (hash بسيط) */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** يستخرج الأحرف الأولى من اسم عربي/لاتيني */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '؟';
  // تقسيم بالمسافات وأخذ أول حرف من أول كلمتين
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }
  return (parts[0][0] ?? '') + (parts[1][0] ?? '');
}

type AvatarProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Avatar({ name, size = 40, className = '' }: AvatarProps) {
  const colorIndex = hashString(name) % AVATAR_COLORS.length;
  const color = AVATAR_COLORS[colorIndex];
  const initials = getInitials(name);

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${color} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
