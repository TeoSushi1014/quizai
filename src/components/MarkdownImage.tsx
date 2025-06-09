
import React, { useState, useEffect } from 'react';

interface MarkdownImageProps {
  src?: string | Blob; // Accept string, Blob, or undefined
  alt?: string;
}

const MarkdownImage: React.FC<MarkdownImageProps> = ({ src, alt = '' }) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let objectUrl: string | undefined;
    setIsError(false); // Reset error state on src change

    if (typeof src === 'string') {
      setImageSrc(src);
    } else if (src instanceof Blob) {
      objectUrl = URL.createObjectURL(src);
      setImageSrc(objectUrl);
    } else {
      setImageSrc(undefined);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  const handleError = () => {
    setIsError(true);
  };

  if (!imageSrc || isError) {
    return (
      <div className="flex justify-center items-center h-24 bg-[var(--color-bg-surface-2)] rounded-md border border-[var(--color-border-default)] p-4 text-[var(--color-text-secondary)] text-sm my-2">
        {isError ? "Không thể tải hình ảnh" : (alt || "Không có hình ảnh")}
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      onError={handleError}
      className="max-w-full h-auto rounded-md my-2 block mx-auto" // Added block and mx-auto for centering
      loading="lazy"
    />
  );
};
MarkdownImage.displayName = "MarkdownImageSimple";
export default MarkdownImage;
