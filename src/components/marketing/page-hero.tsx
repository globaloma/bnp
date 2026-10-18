import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Photo banner at the top of every inner marketing page. */
export function PageHero({
  title,
  description,
  image,
  crumb,
}: {
  title: string;
  description?: string;
  image: string;
  /** Breadcrumb label for this page, after "Home". */
  crumb: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-navy">
      <Image
        src={image}
        alt=""
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/90 to-navy/55" />
      <div className="absolute inset-y-0 left-0 -z-10 w-1.5 bg-gold" aria-hidden />

      <div className="container-page py-20 sm:py-28">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-mist">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-semibold text-gold-300">{crumb}</span>
        </nav>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
