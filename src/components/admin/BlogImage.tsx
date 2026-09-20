import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlogImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  loading?: "eager" | "lazy";
}

export function BlogImage({
  src,
  fallbackSrc,
  alt,
  className,
  placeholderClassName,
  loading = "lazy",
}: BlogImageProps) {
  const primary = src?.trim() || "";
  const fallback = fallbackSrc?.trim() || "";
  const [activeSrc, setActiveSrc] = useState(primary || fallback);
  const [failed, setFailed] = useState(!primary && !fallback);

  useEffect(() => {
    const nextSrc = primary || fallback;
    setActiveSrc(nextSrc);
    setFailed(!nextSrc);
  }, [primary, fallback]);

  const handleError = () => {
    if (activeSrc !== fallback && fallback) {
      setActiveSrc(fallback);
      return;
    }
    setFailed(true);
  };

  if (failed || !activeSrc) {
    return (
      <div
        role="img"
        aria-label={`${alt} unavailable`}
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          placeholderClassName,
        )}
      >
        <ImageOff className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      key={activeSrc}
      src={activeSrc}
      alt={alt}
      loading={loading}
      className={className}
      onError={handleError}
    />
  );
}