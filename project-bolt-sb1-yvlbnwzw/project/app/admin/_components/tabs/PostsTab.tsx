'use client';

import { Bell, ChevronDown, ExternalLink, Eye, FileText, Filter, Loader2, Search, ToggleLeft, ToggleRight, Trash2, UserCheck, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils/date';
import Link from 'next/link';
import { PostItem } from '../types';

const POST_TYPE_LABELS: Record<string, string> = {
  social_post: 'Feed',
  service_listing: 'Usluga',
  hiring_post: 'Tražim radnika',
  service_request: 'Tražim uslugu',
  job_seeker_post: 'Tražim posao',
};

interface Props {
  posts: PostItem[];
  searchedPosts: PostItem[] | null;
  loading: boolean;
  searchingPosts: boolean;
  postSearch: string;
  postTypeFilter: string;
  hasMorePosts: boolean;
  loadingMorePosts: boolean;
  onSearchChange: (v: string) => void;
  onTypeFilterChange: (v: string) => void;
  onLoadMore: () => void;
  onDeletePost: (postId: string) => void;
  onTogglePromoted: (postId: string, current: boolean) => void;
  onLiftShadow: (postId: string) => void;
  onNotifTargetSet: (target: { id: string; name: string }) => void;
}

export function PostsTab({
  posts,
  searchedPosts,
  loading,
  searchingPosts,
  postSearch,
  postTypeFilter,
  hasMorePosts,
  loadingMorePosts,
  onSearchChange,
  onTypeFilterChange,
  onLoadMore,
  onDeletePost,
  onTogglePromoted,
  onLiftShadow,
  onNotifTargetSet,
}: Props) {
  const displayPosts = (searchedPosts ?? posts).filter(
    p => postTypeFilter === 'all' || p.post_type === postTypeFilter
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Pretraži po imenu korisnika ili tekstu..."
          value={postSearch}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-orange-500/40 text-foreground placeholder:text-muted-foreground"
        />
        {postSearch && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {([
          { value: 'all', label: 'Svi' },
          { value: 'social_post', label: 'Feed' },
          { value: 'service_listing', label: 'Usluge' },
          { value: 'hiring_post', label: 'Zapošljavanje' },
          { value: 'service_request', label: 'Tražim uslugu' },
          { value: 'job_seeker_post', label: 'Tražim posao' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onTypeFilterChange(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              postTypeFilter === value
                ? 'bg-orange-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading || searchingPosts ? (
        [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
      ) : displayPosts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{postSearch ? 'Nema rezultata' : 'Nema postova'}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {displayPosts.map(post => (
              <div key={post.id} className="bg-card border border-border rounded-2xl px-4 py-3 flex items-start gap-3">
                {post.author && (
                  <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                    <AvatarImage src={post.author.avatar_url} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-xs font-semibold">
                      {post.author.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {post.author && (
                      <Link href={`/profile/${post.author.id}`} className="text-sm font-semibold text-foreground hover:underline">
                        {post.author.name}
                      </Link>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {post.views_count || 0}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      {POST_TYPE_LABELS[post.post_type] || post.post_type}
                    </span>
                    {post.is_promoted && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full font-semibold">
                        Sponzorisano
                      </span>
                    )}
                    {post.status !== 'published' && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                        {post.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {post.content || '(bez teksta)'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {post.status === 'shadow_limited' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                      title="Ukloni shadow ban"
                      onClick={() => onLiftShadow(post.id)}
                    >
                      <UserCheck className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-2 rounded-xl text-xs font-semibold ${
                      post.is_promoted
                        ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50'
                    }`}
                    title={post.is_promoted ? 'Ukloni sponzorstvo' : 'Označi kao sponzorisano'}
                    onClick={() => onTogglePromoted(post.id, post.is_promoted)}
                  >
                    {post.is_promoted ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                  {post.author && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                      title="Pošalji notifikaciju autoru"
                      onClick={() => onNotifTargetSet({ id: post.author!.id, name: post.author!.name })}
                    >
                      <Bell className="h-4 w-4" />
                    </Button>
                  )}
                  {!(post.post_type === 'social_post' && !post.content && !post.has_media) && (
                    <Link href={`/posts/${post.id}`} target="_blank">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" title="Pogledaj post">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    title="Obriši post"
                    onClick={() => onDeletePost(post.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {!searchedPosts && hasMorePosts && (
            <button
              onClick={onLoadMore}
              disabled={loadingMorePosts}
              className="w-full py-3 rounded-2xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2"
            >
              {loadingMorePosts
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Učitavanje...</>
                : <><ChevronDown className="h-4 w-4" /> Učitaj još</>
              }
            </button>
          )}
        </>
      )}
    </div>
  );
}
