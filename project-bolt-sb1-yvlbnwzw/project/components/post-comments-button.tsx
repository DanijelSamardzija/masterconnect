'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { CommentsSheet } from '@/components/comments-sheet';

type PostCommentsButtonProps = {
  postId: string;
  commentsCount: number;
  onCommentAdded?: () => void;
};

export function PostCommentsButton({ postId, commentsCount, onCommentAdded }: PostCommentsButtonProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <>
      <div className="border-t pt-3">
        <button
          onClick={() => setCommentsOpen(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">
            Komentari ({commentsCount})
          </span>
        </button>
      </div>

      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        postId={postId}
        commentsCount={commentsCount}
        onCommentAdded={onCommentAdded}
      />
    </>
  );
}
