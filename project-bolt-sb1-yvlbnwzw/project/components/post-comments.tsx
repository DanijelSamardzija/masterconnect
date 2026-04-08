'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { CommentReactions } from '@/components/comment-reactions';
import { ReportModal } from '@/components/report-modal';
import { BlockUserModal } from '@/components/block-user-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageCircle, Send, ChevronDown, ChevronUp, Trash2, MoreVertical, Flag, UserX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProfessionalBadge } from '@/components/professional-badge';

type Comment = {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  parent_comment_id: string | null;
  profiles: {
    id: string;
    name: string;
    account_type: 'professional' | 'customer';
  };
  replies?: Comment[];
};

type PostCommentsProps = {
  postId: string;
  highlightCommentId?: string;
};

export function PostComments({ postId, highlightCommentId }: PostCommentsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [previewComment, setPreviewComment] = useState<Comment | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(new Set());
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; ownerId: string } | null>(null);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ userId: string; userName: string } | null>(null);
  const commentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleUserClick = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  useEffect(() => {
    fetchCommentPreview();

    if (highlightCommentId && !expanded) {
      setExpanded(true);
    }

    if (expanded) {
      fetchComments();
    }

    const channel = supabase
      .channel(`post_comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`
        },
        () => {
          fetchCommentPreview();
          if (expanded) {
            fetchComments();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, expanded]);

  useEffect(() => {
    if (highlightCommentId && comments.length > 0 && commentRefs.current[highlightCommentId]) {
      setTimeout(() => {
        commentRefs.current[highlightCommentId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 300);
    }
  }, [highlightCommentId, comments]);

  const fetchCommentPreview = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCommentCount(0);
        setPreviewComment(null);
        return;
      }

      const { data, count } = await supabase
        .from('post_comments')
        .select('*, profiles(id, name, account_type)', { count: 'exact' })
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false })
        .limit(1);

      setCommentCount(count || 0);
      setPreviewComment(data && data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('Error fetching comment preview:', error);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.error('No active session for fetching comments');
        toast.error('Please sign in to view comments');
        setLoading(false);
        return;
      }

      // Fetch comments directly using Supabase client
      const { data, error } = await supabase
        .from('post_comments')
        .select('*, profiles(id, name, account_type)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch comments:', error);
        toast.error(error.message || 'Failed to load comments');
      } else {
        setComments(organizeComments(data || []));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const organizeComments = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const topLevelComments: Comment[] = [];

    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    flatComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies!.push(commentWithReplies);
        }
      } else {
        topLevelComments.push(commentWithReplies);
      }
    });

    return topLevelComments;
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting || !user) return;

    setSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast.error('Please sign in to comment');
        setSubmitting(false);
        return;
      }

      // Insert comment directly using Supabase client
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          text: commentText.trim()
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to add comment:', error);
        toast.error(error.message || 'Failed to add comment');
      } else {
        setCommentText('');
        fetchComments();
        fetchCommentPreview();
        toast.success('Comment added!');
      }
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(error.message || 'Failed to add comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent, parentId: string, parentName: string) => {
    e.preventDefault();
    if (!replyText.trim() || submitting || !user) return;

    setSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast.error('Please sign in to reply');
        setSubmitting(false);
        return;
      }

      // Insert reply directly using Supabase client
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          text: replyText.trim(),
          parent_comment_id: parentId
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to add reply:', error);
        toast.error(error.message || 'Failed to add reply');
      } else {
        setReplyText('');
        setReplyingTo(null);
        fetchComments();
        fetchCommentPreview();
        toast.success('Reply added!');
      }
    } catch (error: any) {
      console.error('Error adding reply:', error);
      toast.error(error.message || 'Failed to add reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      // Delete comment directly using Supabase client
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user?.id || '');

      if (error) {
        console.error('Error deleting comment:', error);
        toast.error(error.message || 'Failed to delete comment');
      } else {
        fetchComments();
        fetchCommentPreview();
        toast.success('Comment deleted');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const toggleReplies = (commentId: string) => {
    setCollapsedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const repliesCollapsed = collapsedReplies.has(comment.id);
    const isReplyingToThis = replyingTo === comment.id;
    const isHighlighted = highlightCommentId === comment.id;

    return (
      <div
        key={comment.id}
        ref={el => commentRefs.current[comment.id] = el}
        className={cn(
          isReply && "ml-10",
          isHighlighted && "bg-blue-50 border-2 border-blue-300 rounded-lg p-2 -m-2"
        )}
      >
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-slate-600 text-white text-xs">
              {comment.profiles.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="bg-slate-100 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <p
                  className="font-semibold text-sm cursor-pointer hover:underline"
                  onClick={() => handleUserClick(comment.user_id)}
                >
                  {comment.profiles.name}
                </p>
                {comment.profiles.account_type === 'professional' && (
                  <ProfessionalBadge size="sm" />
                )}
              </div>
              <p className="text-sm mt-1 break-words">{comment.text}</p>
            </div>
            <div className="flex items-center gap-3 mt-1 px-1">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
              <button
                onClick={() => {
                  if (replyingTo === comment.id) {
                    setReplyingTo(null);
                    setReplyText('');
                  } else {
                    setReplyingTo(comment.id);
                    setReplyText('');
                  }
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Reply
              </button>
              {user?.id === comment.user_id ? (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <MoreVertical className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setReportTarget({ id: comment.id, ownerId: comment.user_id });
                        setReportModalOpen(true);
                      }}
                    >
                      <Flag className="h-3 w-3 mr-2" />
                      Report
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setBlockTarget({ userId: comment.user_id, userName: comment.profiles.name });
                        setBlockModalOpen(true);
                      }}
                      className="text-red-600"
                    >
                      <UserX className="h-3 w-3 mr-2" />
                      Block user
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="mt-2 px-1">
              <CommentReactions commentId={comment.id} postId={postId} />
            </div>

            {isReplyingToThis && (
              <form
                onSubmit={(e) => handleSubmitReply(e, comment.id, comment.profiles.name)}
                className="mt-3 flex gap-2"
              >
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${comment.profiles.name}...`}
                  disabled={submitting}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!replyText.trim() || submitting}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}

            {hasReplies && (
              <div className="mt-3">
                {comment.replies!.length > 1 && (
                  <button
                    onClick={() => toggleReplies(comment.id)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
                  >
                    {repliesCollapsed ? (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        View replies ({comment.replies!.length})
                      </>
                    ) : (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Hide replies
                      </>
                    )}
                  </button>
                )}
                {(!repliesCollapsed || comment.replies!.length === 1) && (
                  <div className="space-y-3">
                    {comment.replies!.map(reply => renderComment(reply, true))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">
            Comments ({commentCount})
          </span>
        </div>
      </div>

      {!expanded && commentCount > 1 && (
        <div className="mb-3 pl-6">
          <button
            onClick={() => setExpanded(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View all comments ({commentCount})
          </button>
        </div>
      )}

      {!expanded && commentCount === 1 && previewComment && (
        <div className="mb-3 pl-6">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-slate-600 text-white text-xs">
                {previewComment.profiles.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="bg-slate-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <p
                    className="font-semibold text-sm cursor-pointer hover:underline"
                    onClick={() => handleUserClick(previewComment.user_id)}
                  >
                    {previewComment.profiles.name}
                  </p>
                  {previewComment.profiles.account_type === 'professional' && (
                    <ProfessionalBadge size="sm" />
                  )}
                </div>
                <p className="text-sm mt-1 break-words">{previewComment.text}</p>
              </div>
              <div className="flex items-center gap-3 mt-1 px-1">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(previewComment.created_at), { addSuffix: true })}
                </span>
                {user?.id === previewComment.user_id && (
                  <button
                    onClick={() => handleDeleteComment(previewComment.id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="mt-2 px-1">
                <CommentReactions commentId={previewComment.id} postId={postId} />
              </div>
            </div>
          </div>
        </div>
      )}

      {!expanded && commentCount === 0 && (
        <div className="mb-3 pl-6">
          <p className="text-sm text-muted-foreground">
            No comments yet. Be the first to comment!
          </p>
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setExpanded(false)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Hide comments
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => renderComment(comment))}
            </div>
          )}
        </div>
      )}

      {/* Comment input - always visible */}
      {user ? (
        <form onSubmit={handleSubmitComment} className="flex gap-2 mt-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-blue-600 text-white text-xs">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              disabled={submitting}
              className="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!commentText.trim() || submitting}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-center py-4 bg-slate-50 rounded-lg border mt-3">
          <p className="text-sm text-muted-foreground">
            Please sign in to comment
          </p>
        </div>
      )}

      {reportTarget && (
        <ReportModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          targetType="comment"
          targetId={reportTarget.id}
          targetOwnerUserId={reportTarget.ownerId}
        />
      )}

      {blockTarget && (
        <BlockUserModal
          open={blockModalOpen}
          onOpenChange={setBlockModalOpen}
          userId={blockTarget.userId}
          userName={blockTarget.userName}
          onBlockSuccess={() => {
            fetchComments();
            fetchCommentPreview();
          }}
        />
      )}
    </div>
  );
}
