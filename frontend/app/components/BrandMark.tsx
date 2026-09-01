import Image from 'next/image';

export default function BrandMark({ size = 34, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/selfhost-logo.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      draggable={false}
    />
  );
}
