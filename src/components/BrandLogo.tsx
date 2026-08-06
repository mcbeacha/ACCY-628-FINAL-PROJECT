import Image from "next/image";
import Link from "next/link";
import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";

const LOGO_SRC = "/rebel-law-group-logo.png";

type Props = {
  /** Compact mark + wordmark for the top navbar. */
  variant?: "header" | "sidebar";
  href?: string;
};

export function BrandLogo({ variant = "header", href = "/dashboard" }: Props) {
  if (variant === "sidebar") {
    return (
      <Link
        href={href}
        className="block mb-4 -mx-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-lg"
        aria-label={APP_NAME}
      >
        <Image
          src={LOGO_SRC}
          alt={APP_NAME}
          width={220}
          height={260}
          className="w-full max-w-[11rem] mx-auto h-auto object-contain"
          priority
          unoptimized
        />
      </Link>
    );
  }

  return (
    <Link href={href} className="flex items-center gap-2 min-w-0" aria-label={APP_NAME}>
      <Image
        src={LOGO_SRC}
        alt=""
        width={40}
        height={40}
        className="h-9 w-9 shrink-0 rounded-md object-cover object-top bg-base-100 border border-base-300"
        priority
      />
      <span className="min-w-0 hidden sm:block">
        <span className="font-display text-[0.95rem] sm:text-base block truncate leading-tight">
          {APP_NAME}
        </span>
        <span className="text-[0.7rem] text-base-content/50 hidden md:block truncate tracking-wide uppercase">
          {APP_SUBTITLE}
        </span>
      </span>
    </Link>
  );
}
