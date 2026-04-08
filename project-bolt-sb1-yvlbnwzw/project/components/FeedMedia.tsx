import React from 'react';

interface FeedMediaProps {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  isMuted?: boolean;
  videoRef?: React.Ref<HTMLVideoElement>;
}

export function FeedMedia({
  type,
  src,
  alt,
  isMuted = true, // Podrazumevano mora biti true zbog autoplay-a
  videoRef
}: FeedMediaProps) {
  return (
    <div className="feedMedia absolute inset-0 bg-black">
      {type === 'video' ? (
        <video
          ref={videoRef}
          src={src}
          className="absolute inset-0 w-full h-full object-contain"
          autoPlay
          muted={isMuted}
          playsInline
          loop
        />
      ) : (
        <img
          src={src}
          alt={alt || ''}
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />
      )}
    </div>
  );
}