'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Home, Star, MapPin, Play, MessageSquare, Heart, Eye,
  CheckCircle, Share2, Bookmark, MoreVertical, Flag, Trash2, Phone, UserPlus, Search, Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  text: string;
  city: string;
  category: string;
  created_at: string;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  media: { url: string; media_type: string }[];
  user: {
    name: string;
    avatar_url: string;
    account_type: 'professional' | 'customer';
    average_rating?: number;
    review_count?: number;
  };
}

type Filter = 'all' | 'professional' | 'customer';

const HEADER_H = 52; // py-2 (16px) + h-9 (36px)

export default function FeedPreviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    const checkAdmin = async () => {
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!data?.is_admin) { router.push('/feed'); return; }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchPosts = async () => {
      const res = await fetch('/api/posts?limit=20&offset=0');
      if (!res.ok) return;
      const json = await res.json();
      setPosts(json.data || []);
      setLoading(false);
    };
    fetchPosts();
  }, [isAdmin]);

  if (authLoading || !isAdmin) return <div className="h-dvh bg-background" />;

  const filtered = posts.filter(p =>
    filter === 'all' ? true : p.user.account_type === filter
  );

  return (
    <div className="h-dvh overflow-hidden bg-background">
      {/* Header — centriran, kompaktan */}
      <div className="bg-background/95 backdrop-blur border-b border-border py-2 flex items-center justify-center gap-5">
        <button onClick={() => router.push('/feed')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Home className="h-5 w-5" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 transition-colors text-white shadow-md">
          <Plus className="h-5 w-5" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground">Učitavanje...</div>
      ) : (
        <div
          className="overflow-y-scroll snap-y snap-mandatory"
          style={{ height: `calc(100dvh - ${HEADER_H}px)` }}
        >
          {filtered.map(post => (
            <div
              key={post.id}
              className="snap-start px-2 py-1"
              style={{ height: `calc(100dvh - ${HEADER_H}px)` }}
            >
              {post.user.account_type === 'professional'
                ? <ProCard post={post} />
                : <CustomerCard post={post} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaBlock({ media, count }: { media: { url: string; media_type: string }; count: number }) {
  const isVid = media.url?.match(/\.(mp4|mov|webm)/i) || media.media_type === 'video';
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="relative bg-black w-full h-full overflow-hidden">
      {isVid ? (
        <>
          <video
            ref={videoRef}
            src={media.url}
            className="w-full h-full object-contain"
            muted
            playsInline
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-3">
              <Play className="h-8 w-8 text-white fill-white" />
            </div>
          </div>
        </>
      ) : (
        <img src={media.url} alt="" className="w-full h-full object-cover" />
      )}
      {count > 1 && (
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
          1/{count}
        </div>
      )}
    </div>
  );
}

function ThreeDotMenu({ isOwn }: { isOwn?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground p-1">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[150px]">
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted">
            <Bookmark className="h-4 w-4" /> Sačuvaj
          </button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted">
            <Flag className="h-4 w-4" /> Prijavi
          </button>
          {isOwn && (
            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-muted">
              <Trash2 className="h-4 w-4" /> Obriši
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProCard({ post }: { post: Post }) {
  const media = post.media[0];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm border-l-4 border-l-orange-500 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={post.user.avatar_url} />
          <AvatarFallback>{post.user.name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-foreground truncate">{post.user.name}</span>
            <CheckCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] px-1.5 py-0 h-4">PRO</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {post.user.average_rating && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {post.user.average_rating.toFixed(1)}
              </span>
            )}
            {post.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{post.city}</span>}
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold transition-colors">
            <UserPlus className="h-3 w-3" /> Prati
          </button>
          <ThreeDotMenu />
        </div>
      </div>

      {/* Media — razvlači se */}
      {media && (
        <div className="flex-1 min-h-0">
          <MediaBlock media={media} count={post.media.length} />
        </div>
      )}

      {/* Text */}
      {post.text && (
        <div className="px-3 pt-2 pb-1 text-sm text-foreground line-clamp-2 shrink-0">{post.text}</div>
      )}

      {post.category && (
        <div className="px-3 pb-1 shrink-0">
          <Badge variant="outline" className="text-xs">{post.category}</Badge>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center px-3 py-2 border-t border-border gap-1 shrink-0">
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Heart className="h-4 w-4" />{post.reactions_count}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <MessageSquare className="h-4 w-4" />{post.comments_count}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Eye className="h-4 w-4" />{post.views_count}
        </button>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Bookmark className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Share2 className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors">
          <Phone className="h-3.5 w-3.5" /> Kontakt
        </button>
      </div>
    </div>
  );
}

function CustomerCard({ post }: { post: Post }) {
  const media = post.media[0];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm border-l-4 border-l-blue-500 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={post.user.avatar_url} />
          <AvatarFallback>{post.user.name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-foreground truncate block">{post.user.name}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {post.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{post.city}</span>}
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] px-1.5 py-0 h-4 shrink-0">Klijent</Badge>
          <ThreeDotMenu />
        </div>
      </div>

      {/* Text */}
      {post.text && (
        <div className="px-3 pb-2 text-sm text-foreground line-clamp-3 shrink-0">{post.text}</div>
      )}

      {/* Media — razvlači se */}
      {media && (
        <div className="flex-1 min-h-0 mx-3 mb-2 rounded-xl overflow-hidden">
          <MediaBlock media={media} count={post.media.length} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center px-3 py-2 border-t border-border gap-1 shrink-0">
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Heart className="h-4 w-4" />{post.reactions_count}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <MessageSquare className="h-4 w-4" />{post.comments_count}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Eye className="h-4 w-4" />{post.views_count}
        </button>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Bookmark className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
