'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, Heart, CornerDownRight, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

type Reply = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
  user: { name: string; avatar_url?: string };
};

type Comment = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
  user: { name: string; avatar_url?: string };
  replies: Reply[];
};

type CommentRowProps = {
  c: Comment | Reply;
  isReply?: boolean;
  parentCommentId?: string;
  user: any;
  likingIds: Set<string>;
  replyingTo: { id: string; name: string } | null;
  onLike: (id: string, liked: boolean) => void;
  onReply: (id: string, name: string) => void;
};

function CommentRow({ c, isReply = false, parentCommentId, user, likingIds, replyingTo, onLike, onReply }: CommentRowProps) {
  const replyTargetId = isReply && parentCommentId ? parentCommentId : c.id;
  return (
    <div className={`flex gap-2.5 ${isReply ? 'ml-9' : ''}`}>
      <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
        <AvatarImage src={c.user.avatar_url} />
        <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
          {c.user.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="bg-muted rounded-2xl px-3 py-2">
          <p className="text-xs font-semibold text-foreground leading-tight">{c.user.name}</p>
          <p className="text-sm text-foreground/80 mt-0.5 break-words leading-snug">{c.text}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 px-1">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
          </span>
          <button
            onClick={() => onLike(c.id, c.liked_by_me)}
            disabled={!user || likingIds.has(c.id)}
            className="flex items-center gap-1 transition-all active:scale-90 disabled:opacity-40"
          >
            <Heart className={`h-3.5 w-3.5 transition-colors ${c.liked_by_me ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400'}`} />
            {c.likes_count > 0 && (
              <span className={`text-[10px] font-medium ${c.liked_by_me ? 'text-red-400' : 'text-muted-foreground'}`}>
                {c.likes_count}
              </span>
            )}
          </button>
          {user && (
            <button
              onClick={() => onReply(replyTargetId, c.user.name)}
              className={`text-[10px] font-semibold transition-colors ${replyingTo?.id === replyTargetId ? 'text-orange-500' : 'text-muted-foreground hover:text-orange-500'}`}
            >
              Odgovori
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type CommentsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  commentsCount: number;
  onCommentAdded?: () => void;
};

export function CommentsSheet({ open, onOpenChange, postId, commentsCount, onCommentAdded }: CommentsSheetProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && postId) fetchComments();
  }, [open, postId]);

  useEffect(() => {
    if (replyingTo) replyInputRef.current?.focus();
  }, [replyingTo]);

  const fetchComments = async () => {
    try {
      setLoading(true);

      // Fetch top-level comments
      const { data: topData, error } = await supabase
        .from('post_comments')
        .select(`id, user_id, text, created_at, profiles:user_id(name, avatar_url)`)
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch all replies for this post
      const { data: replyData } = await supabase
        .from('post_comments')
        .select(`id, user_id, text, created_at, parent_comment_id, profiles:user_id(name, avatar_url)`)
        .eq('post_id', postId)
        .not('parent_comment_id', 'is', null)
        .order('created_at', { ascending: true });

      // Fetch all reactions for this post's comments
      const allCommentIds = [
        ...(topData || []).map((c: any) => c.id),
        ...(replyData || []).map((r: any) => r.id),
      ];

      let reactions: any[] = [];
      if (allCommentIds.length > 0) {
        const { data: reactionData } = await supabase
          .from('comment_reactions')
          .select('comment_id, user_id')
          .in('comment_id', allCommentIds);
        reactions = reactionData || [];
      }

      const likesMap: Record<string, number> = {};
      const likedByMe: Record<string, boolean> = {};
      for (const r of reactions) {
        likesMap[r.comment_id] = (likesMap[r.comment_id] || 0) + 1;
        if (user && r.user_id === user.id) likedByMe[r.comment_id] = true;
      }

      const repliesMap: Record<string, Reply[]> = {};
      for (const r of replyData || []) {
        const pid = r.parent_comment_id;
        if (!repliesMap[pid]) repliesMap[pid] = [];
        repliesMap[pid].push({
          id: r.id,
          user_id: r.user_id,
          text: r.text,
          created_at: r.created_at,
          likes_count: likesMap[r.id] || 0,
          liked_by_me: !!likedByMe[r.id],
          user: { name: r.profiles?.name || 'Unknown', avatar_url: r.profiles?.avatar_url },
        });
      }

      setComments(
        (topData || []).map((c: any) => ({
          id: c.id,
          user_id: c.user_id,
          text: c.text,
          created_at: c.created_at,
          likes_count: likesMap[c.id] || 0,
          liked_by_me: !!likedByMe[c.id],
          user: { name: c.profiles?.name || 'Unknown', avatar_url: c.profiles?.avatar_url },
          replies: repliesMap[c.id] || [],
        }))
      );

      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 50);
    } catch {
      toast.error('Greška pri učitavanju komentara');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return;
    try {
      setSubmitting(true);
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        text: newComment.trim(),
      });
      if (error) throw error;
      setNewComment('');
      await fetchComments();
      onCommentAdded?.();
    } catch {
      toast.error('Greška pri dodavanju komentara');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!user || !replyText.trim() || !replyingTo) return;
    try {
      setSubmittingReply(true);
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        text: replyText.trim(),
        parent_comment_id: replyingTo.id,
      });
      if (error) throw error;
      setReplyText('');
      setReplyingTo(null);
      setExpandedReplies(prev => new Set(prev).add(replyingTo!.id));
      await fetchComments();
    } catch {
      toast.error('Greška pri dodavanju odgovora');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleLike = async (commentId: string, liked: boolean) => {
    if (!user) return;
    setLikingIds(prev => new Set(prev).add(commentId));

    // Optimistic update
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return { ...c, liked_by_me: !liked, likes_count: liked ? c.likes_count - 1 : c.likes_count + 1 };
      }
      return {
        ...c,
        replies: c.replies.map(r =>
          r.id === commentId
            ? { ...r, liked_by_me: !liked, likes_count: liked ? r.likes_count - 1 : r.likes_count + 1 }
            : r
        ),
      };
    }));

    try {
      if (liked) {
        await supabase.from('comment_reactions').delete()
          .eq('comment_id', commentId).eq('user_id', user.id);
      } else {
        await supabase.from('comment_reactions').insert({
          comment_id: commentId, user_id: user.id, emoji: '❤️',
        });
      }
    } catch {
      // Revert on error
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, liked_by_me: liked, likes_count: liked ? c.likes_count + 1 : c.likes_count - 1 };
        }
        return {
          ...c,
          replies: c.replies.map(r =>
            r.id === commentId
              ? { ...r, liked_by_me: liked, likes_count: liked ? r.likes_count + 1 : r.likes_count - 1 }
              : r
          ),
        };
      }));
    } finally {
      setLikingIds(prev => { const s = new Set(prev); s.delete(commentId); return s; });
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const s = new Set(prev);
      s.has(commentId) ? s.delete(commentId) : s.add(commentId);
      return s;
    });
  };

  const handleReplyToggle = (id: string, name: string) => {
    setReplyingTo(prev => prev?.id === id ? null : { id, name });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg flex flex-col bg-background border border-border rounded-t-3xl overflow-hidden shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4 duration-200"
          style={{ maxHeight: '75vh' }}
        >

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <span className="text-foreground font-semibold text-base">Komentari ({commentsCount})</span>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">Nema komentara. Budi prvi!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <CommentRow
                  c={comment}
                  user={user}
                  likingIds={likingIds}
                  replyingTo={replyingTo}
                  onLike={handleLike}
                  onReply={handleReplyToggle}
                />

                {/* Replies toggle */}
                {comment.replies.length > 0 && (
                  <button
                    onClick={() => toggleReplies(comment.id)}
                    className="ml-9 flex items-center gap-1 text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <CornerDownRight className="h-3 w-3" />
                    {expandedReplies.has(comment.id)
                      ? 'Sakrij odgovore'
                      : `Prikaži ${comment.replies.length} ${comment.replies.length === 1 ? 'odgovor' : 'odgovora'}`}
                  </button>
                )}

                {/* Replies */}
                {expandedReplies.has(comment.id) && (
                  <div className="space-y-2">
                    {comment.replies.map(reply => (
                      <CommentRow
                        key={reply.id}
                        c={reply}
                        isReply
                        parentCommentId={comment.id}
                        user={user}
                        likingIds={likingIds}
                        replyingTo={replyingTo}
                        onLike={handleLike}
                        onReply={handleReplyToggle}
                      />
                    ))}
                  </div>
                )}

                {/* Reply input */}
                {replyingTo?.id === comment.id && (
                  <div className="ml-9 flex items-center gap-2">
                    <input
                      ref={replyInputRef}
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleReplySubmit(); if (e.key === 'Escape') setReplyingTo(null); }}
                      placeholder={`Odgovori ${comment.user.name}...`}
                      disabled={submittingReply}
                      className="flex-1 h-8 rounded-full border border-border bg-muted px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-400/50 transition-colors"
                    />
                    <button
                      onClick={handleReplySubmit}
                      disabled={!replyText.trim() || submittingReply}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
                    >
                      {submittingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Main input */}
        <div className="px-4 py-3 border-t border-border flex-shrink-0 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Dodaj komentar..."
            disabled={submitting}
            className="flex-1 h-10 rounded-full border border-border bg-muted px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-400/50 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>

        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
