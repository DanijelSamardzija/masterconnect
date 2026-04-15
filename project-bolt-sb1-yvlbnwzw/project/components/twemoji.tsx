'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

const INTERNAL_HOSTS = ['gigzone.app', 'www.gigzone.app'];

function isInternalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return INTERNAL_HOSTS.includes(host);
  } catch {
    return false;
  }
}

export function MessageText({ text, className, linkClassName }: MessageTextProps) {
  const router = useRouter();
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
      {parts.map((part, i) => {
        if (part.type !== 'url') return <TwemojiText key={i} text={part.value} />;

        const internal = isInternalUrl(part.value);
        return (
          <a
            key={i}
            href={part.value}
            target={internal ? '_self' : '_blank'}
            rel={internal ? undefined : 'noopener noreferrer'}
            className={linkClassName ?? 'underline break-all'}
            onClick={(e) => {
              e.stopPropagation();
              if (internal) {
                e.preventDefault();
                const path = new URL(part.value).pathname + new URL(part.value).search;
                router.push(path);
              }
            }}
          >
            {part.value}
          </a>
        );
      })}
    </span>
  );
}
