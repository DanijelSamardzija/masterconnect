'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, MapPin, Briefcase, Calendar, DollarSign, User, AlertCircle, Star, CreditCard, CheckCircle2, Trash2, MessageSquare } from 'lucide-react';
import { ReviewModal } from '@/components/review-modal';
import { toast } from 'sonner';

type Job = {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  budget: string | null;
  preferred_date: string | null;
  status: string;
  created_at: string;
  customer_id: string;
  payment_status: string | null;
  completed_at: string | null;
  customer?: {
    name: string;
    email: string;
  };
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  customer: {
    name: string;
  };
};

type Props = {
  jobId: string;
  initialData: Job | null;
};

export function JobDetailsClient({ jobId, initialData }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const fromChat = searchParams.get('from') === 'chat';
  const threadId = searchParams.get('threadId');

  const [job] = useState<Job | null>(initialData);
  const [error, setError] = useState('');
  const [hasAccess, setHasAccess] = useState(!fromChat);
  const [review, setReview] = useState<Review | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [jobThread, setJobThread] = useState<{id: string, pro_id: string, pro_name: string} | null>(null);
  const [contactLoading, setContactLoading] = useState(false);

  const handleBack = () => {
    if (fromChat && threadId) {
      router.push(`/messages/${threadId}`);
    } else {
      router.push('/jobs');
    }
  };

  useEffect(() => {
    if (!fromChat || !user || !job) return;

    // For fromChat flow, verify thread access
    (async () => {
      if (!threadId) { setError('Thread not found'); return; }

      const { data: thread } = await supabase
        .from('threads')
        .select('id, user1_id, user2_id, job_id')
        .eq('id', threadId)
        .maybeSingle();

      if (!thread) { setError('Thread not found'); return; }
      if (thread.user1_id !== user.id && thread.user2_id !== user.id) {
        setError('You do not have access to this job');
        return;
      }
      if (thread.job_id !== jobId) {
        setError('This job is not associated with the chat thread');
        return;
      }
      setHasAccess(true);
    })();
  }, [user]);

  useEffect(() => {
    if (!job || job.status !== 'completed' || !user) return;

    (async () => {
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('*, customer:profiles!reviews_customer_id_fkey(name)')
        .eq('job_id', jobId)
        .maybeSingle();

      if (reviewData) setReview(reviewData as any);

      const { data: threadData } = await supabase
        .from('threads')
        .select('id, user1_id, user2_id, user1:profiles!threads_user1_id_fkey(name), user2:profiles!threads_user2_id_fkey(name)')
        .eq('job_id', jobId)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .maybeSingle();

      if (threadData) {
        const otherUserId = threadData.user1_id === user.id ? threadData.user2_id : threadData.user1_id;
        const otherUser = threadData.user1_id === user.id ? threadData.user2 : threadData.user1;
        setJobThread({ id: threadData.id, pro_id: otherUserId, pro_name: (otherUser as any)?.name || '' });
      }
    })();
  }, [user, job?.status]);

  const handleDeleteJob = async () => {
    try {
      const { error: deleteError } = await supabase.from('jobs').delete().eq('id', jobId);
      if (deleteError) { toast.error('Failed to delete job'); return; }
      toast.success('Job deleted successfully');
      router.push('/dashboard');
    } catch (err) {
      toast.error('An error occurred while deleting the job');
    }
  };

  const handleContactCustomer = async () => {
    if (!user || !job) return;
    if (job.customer_id === user.id) { toast.error('Ne možete kontaktirati svoj posao'); return; }

    setContactLoading(true);
    try {
      const response = await fetch('/api/messages/create-direct-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ targetUserId: job.customer_id }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create conversation');
      }
      const { threadId: newThreadId } = await response.json();
      router.push(`/messages/${newThreadId}`);
    } catch (error: any) {
      toast.error(error.message || 'Greška pri kreiranju razgovora');
    } finally {
      setContactLoading(false);
    }
  };

  if (error || (!hasAccess && fromChat)) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button variant="ghost" className="mb-6" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {fromChat ? 'Back to Chat' : 'Back to Jobs'}
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'You do not have access to this job'}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button variant="ghost" className="mb-6" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Job not found</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 py-8 pb-24">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {fromChat ? 'Back to Chat' : 'Back to Jobs'}
          </Button>

          {user?.id === job.customer_id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Job
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this job posting.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteJob} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{job.title}</CardTitle>
                <CardDescription className="flex items-center gap-4 text-base">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {job.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {job.category}
                  </span>
                </CardDescription>
              </div>
              <Badge variant={job.status === 'completed' ? 'default' : job.status === 'open' ? 'default' : 'secondary'} className={job.status === 'completed' ? 'bg-green-100 text-green-800' : ''}>
                {job.status === 'completed' ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" />Completed</>
                ) : job.status === 'open' ? 'Open' : 'Closed'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
            </div>

            <Separator />

            <div className="grid md:grid-cols-2 gap-6">
              {job.budget && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <DollarSign className="h-4 w-4" />
                    Budget
                  </div>
                  <p className="text-muted-foreground">{job.budget}</p>
                </div>
              )}
              {job.preferred_date && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <Calendar className="h-4 w-4" />
                    Preferred Date
                  </div>
                  <p className="text-muted-foreground">{job.preferred_date}</p>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Posted By
                </div>
                {user && job.customer_id !== user.id && (
                  <Button size="sm" onClick={handleContactCustomer} disabled={contactLoading} className="gap-2 bg-orange-600 hover:bg-orange-700">
                    <MessageSquare className="h-4 w-4" />
                    {contactLoading ? 'Otvaranje...' : 'Kontaktiraj'}
                  </Button>
                )}
              </div>
              {job.customer && (
                <div className="space-y-1">
                  <p className="font-medium">{job.customer.name}</p>
                  {user && <p className="text-sm text-muted-foreground">{job.customer.email}</p>}
                </div>
              )}
            </div>

            <Separator />

            {job.status === 'completed' && (
              <>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Status
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={job.payment_status === 'paid' ? 'default' : 'secondary'}>
                      {job.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">(Coming soon)</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Star className="h-4 w-4" />
                      Customer Review
                    </div>
                    {!review && user?.id === job.customer_id && jobThread && (
                      <Button size="sm" onClick={() => setShowReviewModal(true)}>
                        Leave a review
                      </Button>
                    )}
                  </div>
                  {review ? (
                    <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
                          ))}
                        </div>
                        <span className="text-sm font-medium">{review.rating}/5</span>
                      </div>
                      {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                      <p className="text-xs text-muted-foreground">
                        by {review.customer.name} on{' '}
                        {new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No review yet</p>
                  )}
                </div>

                <Separator />
              </>
            )}

            <div className="text-sm text-muted-foreground">
              Posted on {new Date(job.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              {job.completed_at && (
                <> {' • '}Completed on {new Date(job.completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {jobThread && (
        <ReviewModal
          open={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          jobId={jobId}
          proId={jobThread.pro_id}
          proName={jobThread.pro_name}
          threadId={jobThread.id}
          onSuccess={async () => {
            const { data: reviews } = await supabase.from('reviews').select('rating').eq('pro_id', jobThread.pro_id);
            if (reviews && reviews.length > 0) {
              const avgRating = reviews.reduce((acc: any, r: any) => acc + r.rating, 0) / reviews.length;
              await supabase.from('profiles').update({ average_rating: avgRating, review_count: reviews.length }).eq('id', jobThread.pro_id);
            }
            toast.success('Review submitted successfully!');
          }}
        />
      )}
    </div>
  );
}
