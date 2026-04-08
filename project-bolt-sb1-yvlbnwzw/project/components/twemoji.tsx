'use client';

import { useEffect, useRef } from 'react';
import twemoji from 'twemoji';

interface TwemojiProps {
  children: string;
  className?: string;
  options?: {
    base?: string;
    ext?: string;
    size?: string;
    folder?: string;
  };
}

export function Twemoji({ children, className, options }: TwemojiProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      const defaultOptions = {
        base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
        ext: '.svg',
        size: 'svg',
        folder: 'svg',
        ...options,
      };

      twemoji.parse(ref.current, defaultOptions);
    }
  }, [children, options]);

  return (
    <span
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: children }}
    />
  );
}

interface TwemojiTextProps {
  text: string;
  className?: string;
}

export function TwemojiText({ text, className }: TwemojiTextProps) {
  const parsed = twemoji.parse(text, {
    base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
    ext: '.svg',
    size: 'svg',
    folder: 'svg',
  });

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: parsed }}
    />
  );
}
