'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Star, MapPin, Play, MessageSquare, Heart, Eye,
  CheckCircle, Share2, Bookmark, MoreVertical, Flag, Trash2, Phone, UserPlus
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

  if (authLoading || !isAdmin) return <div className="min-h-screen bg-background" />;

  const filtered = posts.filter(p =>
    filter === 'all' ? true : p.user.account_type === filter
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/admin')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-bold text-lg flex-1">Feed Preview — Novi dizajn</h1>
        <Badge variant="outline" className="text-orange-500 border-orange-500 text-xs">Admin only</Badge>
      </div>

      <div className="flex gap-2 px-4 py-3 border-b border-border">
        {([
          { value: 'all', label: 'Sve' },
          { value: 'professional', label: '🔧 Radovi' },
          { value: 'customer', label: '⭐ Recenzije' },
        ] as { value: Filter; label: string }[]).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === value ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground">Učitavanje...</div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {filtered.map(post => (
            post.user.account_type === 'professional'
              ? <ProCard key={post.id} post={post} />
              : <CustomerCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaBlock({ media, count }: { media: { url: string; media_type: string }; count: number }) {
  const isVid = media.url?.match(/\.(mp4|mov|webm)/i) || media.media_type === 'video';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [portrait, setPortrait] = useState(false);

  const handleMetadata = () => {
    const v = videoRef.current;
    if (v) setPortrait(v.videoHeight > v.videoWidth);
  };

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setPortrait(img.naturalHeight > img.naturalWidth);
  };

  const aspectClass = portrait ? 'aspect-[9/16] max-h-[70vh]' : 'aspect-[4/3]';

  return (
    <div className={`relative bg-black w-full ${aspectClass} overflow-hidden`}>
      {isVid ? (
        <>
          <video
            ref={videoRef}
            src={media.url}
            className="w-full h-full object-contain"
            muted
            playsInline
            onLoadedMetadata={handleMetadata}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-3">
              <Play className="h-8 w-8 text-white fill-white" />
            </div>
          </div>
        </>
      ) : (
        <img src={media.url} alt="" className="w-full h-full object-cover" onLoad={handleImgLoad} />
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
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm border-l-4 border-l-orange-500">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-10 w-10">
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

      {/* Media */}
      {media && <MediaBlock media={media} count={post.media.length} />}

      {/* Text */}
      {post.text && (
        <div className="px-3 pt-2 pb-1 text-sm text-foreground line-clamp-3">{post.text}</div>
      )}

      {post.category && (
        <div className="px-3 pb-2">
          <Badge variant="outline" className="text-xs">{post.category}</Badge>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center px-3 py-2 border-t border-border gap-1">
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
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm border-l-4 border-l-blue-500">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-10 w-10">
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

      {/* Text first */}
      {post.text && (
        <div className="px-3 pb-2 text-sm text-foreground line-clamp-4">{post.text}</div>
      )}

      {/* Media */}
      {media && (
        <div className="mx-3 mb-2 rounded-xl overflow-hidden">
          <MediaBlock media={media} count={post.media.length} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center px-3 py-2 border-t border-border gap-1">
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
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
