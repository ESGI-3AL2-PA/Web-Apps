import { useEffect, useRef, useState } from "react";
import { fetchImageBlob } from "../api-service/uploads.service";

// Renders an image served by the auth-gated /uploads/images endpoint. A plain <img src>
// can't send the Bearer token, so we blob-fetch the bytes (token auto-attached) and show
// them via an object URL. Lazy (IntersectionObserver) so a grid of cards doesn't fetch
// every off-screen cover at once. Falls back to a neutral placeholder while loading.
export default function AuthedImage({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    let objectUrl: string | null = null;
    let active = true;
    fetchImageBlob(src)
      .then((b) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, inView]);

  if (url) return <img src={url} alt={alt} className={className} />;
  return <div ref={placeholderRef} className={`${className ?? ""} animate-pulse bg-neutral-200 dark:bg-neutral-700`} />;
}
