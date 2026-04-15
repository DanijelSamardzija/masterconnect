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

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

interface MessageTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

export function MessageText({ text, className, linkClassName }: MessageTextProps) {
  const parts: Array<{ type: 'text' | 'url'; value: string }> = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_REGEX.source, URL_REGEX.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'url', value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  if (parts.length === 0) {
    return <TwemojiText text={text} className={className} />;
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === 'url' ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName ?? 'underline break-all'}
            onClick={(e) => e.stopPropagation()}
          >
            {part.value}
          </a>
        ) : (
          <TwemojiText key={i} text={part.value} />
        )
      )}
    </span>
  );
}
