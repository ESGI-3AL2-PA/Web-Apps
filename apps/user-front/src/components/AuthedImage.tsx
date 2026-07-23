import { useEffect, useRef, useState } from "react";
import { fetchImageBlob } from "../api-service/uploads.service";

/**
 * Affiche une image servie par l'endpoint /uploads/images protégé par authentification.
 *
 * Une balise <img src> classique ne peut pas envoyer le token Bearer : on récupère donc les
 * octets sous forme de Blob (le token est attaché automatiquement par le service) et on les
 * affiche via un object URL. Le chargement est différé (IntersectionObserver) pour qu'une
 * grille de cartes ne récupère pas d'un coup toutes les couvertures hors écran. Un
 * placeholder neutre (pulsation) est affiché pendant le chargement.
 */
export default function AuthedImage({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  // Observe le placeholder : dès qu'il approche du viewport (marge de 200px), on bascule
  // `inView` à true pour déclencher la récupération de l'image.
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

  // Une fois visible, récupère le Blob et en fait un object URL. Le drapeau `active` évite
  // de poser l'état après démontage et le cleanup révoque l'URL pour ne pas fuir de mémoire.
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
  return <div ref={placeholderRef} className={`${className ?? ""} animate-pulse bg-base-200`} />;
}
