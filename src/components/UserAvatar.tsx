import { useState } from 'react';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}

function initialsOf(name: string): string {
  const parts = name.split(/[\s_.-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function UserAvatar({ name, avatarUrl, className = 'w-9 h-9 text-xs' }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImageFailed(true)}
        className={`rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`rounded-full bg-zinc-700 text-zinc-300 font-semibold flex items-center justify-center shrink-0 ${className}`}
    >
      {initialsOf(name)}
    </div>
  );
}
