import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  className?: string;
  priority?: boolean;
};

export function Logo({ className = "h-16 w-16", priority = false }: LogoProps) {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center rounded-md">
      <Image
        src="/brand/prizespark-logo.png"
        alt="PrizeSpark"
        width={1024}
        height={1024}
        priority={priority}
        className={className}
      />
    </Link>
  );
}
