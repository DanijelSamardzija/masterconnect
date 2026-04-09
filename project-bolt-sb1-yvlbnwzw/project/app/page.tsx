'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Shield, Star, Search, Calendar, MessageSquare, ArrowRight, MapPin, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';

type FeaturedPro = {
  user_id: string;
  bio: string;
  city: string;
  categories: string[];
  verified: boolean;
  starting_price: string | null;
  profiles: {
    name: string;
  };
  avg_rating?: number;
  review_count?: number;
};

export default function Home() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [featuredPros, setFeaturedPros] = useState<FeaturedPro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/feed');
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchFeaturedPros();
  }, []);

  const fetchFeaturedPros = async () => {
    const { data, error } = await supabase
      .from('pro_profiles')
      .select(`
        *,
        profiles!inner(name)
      `)
      .eq('verified', true)
      .limit(3);

    if (!error && data) {
      const prosWithReviews = await Promise.all(
        data.map(async (pro: any) => {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('pro_id', pro.user_id);

          const avg_rating = reviews && reviews.length > 0
            ? reviews.reduce((sum: any, r: any) => sum + r.rating, 0) / reviews.length
            : 0;

          return {
            ...pro,
            avg_rating,
            review_count: reviews?.length || 0,
          } as FeaturedPro;
        })
      );

      setFeaturedPros(prosWithReviews);
    }
    setLoading(false);
  };
  return (
    <div className="pb-24 !bg-white">
      <section className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-amber-900 py-24 md:py-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-white drop-shadow-lg">
              {t('home.hero.title')}
            </h1>
            <p className="text-lg md:text-xl text-orange-50 mb-10 max-w-2xl mx-auto font-medium drop-shadow">
              {t('home.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/services">
                <Button size="lg" className="text-lg px-8 w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow bg-white text-orange-700 hover:bg-orange-50">
                  <Search className="mr-2 h-5 w-5" />
                  {t('home.hero.findPro')}
                </Button>
              </Link>
              <Link href="/jobs/new">
                <Button size="lg" className="text-lg px-8 border-2 border-white bg-white/10 text-white hover:bg-white hover:text-orange-700 w-full sm:w-auto transition-all font-semibold shadow-lg hover:shadow-xl backdrop-blur-sm">
                  <Wrench className="mr-2 h-5 w-5" />
                  {t('home.hero.postJob')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-800">{t('home.howItWorks.title')}</h2>
          <div className="w-24 h-1 bg-orange-600 mx-auto mb-16"></div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="text-center border-2 hover:border-orange-500 transition-all hover:shadow-lg !bg-white !text-slate-900">
              <CardHeader>
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Search className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-xl !text-slate-800">{t('home.howItWorks.step1.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base !text-slate-600">
                  {t('home.howItWorks.step1.desc')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-2 hover:border-amber-500 transition-all hover:shadow-lg !bg-white !text-slate-900">
              <CardHeader>
                <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-xl !text-slate-800">{t('home.howItWorks.step2.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base !text-slate-600">
                  {t('home.howItWorks.step2.desc')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-2 hover:border-orange-600 transition-all hover:shadow-lg !bg-white !text-slate-900">
              <CardHeader>
                <div className="w-20 h-20 bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Calendar className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-xl !text-slate-800">{t('home.howItWorks.step3.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base !text-slate-600">
                  {t('home.howItWorks.step3.desc')}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-800">{t('home.whyChoose.title')}</h2>
          <div className="w-24 h-1 bg-orange-600 mx-auto mb-16"></div>
          <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
            <div className="flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-md">
                <Shield className="w-10 h-10 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{t('home.whyChoose.verified.title')}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t('home.whyChoose.verified.desc')}
              </p>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-md">
                <Star className="w-10 h-10 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{t('home.whyChoose.rated.title')}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t('home.whyChoose.rated.desc')}
              </p>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-md">
                <Wrench className="w-10 h-10 text-orange-700" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{t('home.whyChoose.quality.title')}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t('home.whyChoose.quality.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800">{t('home.featured.title')}</h2>
              <p className="text-slate-600 mt-2 text-lg">{t('home.featured.subtitle')}</p>
            </div>
            <Link href="/services">
              <Button variant="outline" size="lg" className="border-2 border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white transition-colors">
                {t('home.featured.viewAll')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse !bg-white">
                  <CardContent className="p-6">
                    <div className="h-32 bg-slate-200 rounded mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : featuredPros.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {featuredPros.map((pro) => (
                <Card key={pro.user_id} className="hover:shadow-lg transition-shadow !bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-bold text-slate-600">
                          {pro.profiles.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg truncate !text-slate-900">
                            {pro.profiles.name}
                          </h3>
                          {pro.verified && (
                            <CheckCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm !text-slate-600">
                          <MapPin className="h-3 w-3" />
                          <span>{pro.city}</span>
                        </div>
                        {pro.review_count && pro.review_count > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium !text-slate-900">
                              {pro.avg_rating?.toFixed(1)}
                            </span>
                            <span className="text-sm !text-slate-600">
                              ({pro.review_count})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {pro.categories.slice(0, 2).map((cat) => (
                        <Badge key={cat} variant="secondary" className="!bg-slate-100 !text-slate-700">
                          {cat}
                        </Badge>
                      ))}
                      {pro.categories.length > 2 && (
                        <Badge variant="outline" className="!border-slate-300 !text-slate-600">+{pro.categories.length - 2}</Badge>
                      )}
                    </div>

                    <p className="text-sm !text-slate-600 mb-4 line-clamp-2">
                      {pro.bio}
                    </p>

                    {pro.starting_price && (
                      <p className="text-sm font-medium mb-4 text-green-600">
                        {t('home.featured.from')} {pro.starting_price}
                      </p>
                    )}

                    <Button asChild className="w-full">
                      <Link href={`/profile/${pro.user_id}`}>{t('home.featured.viewProfile')}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="relative py-24 bg-gradient-to-br from-orange-600 via-orange-700 to-amber-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white drop-shadow-lg">{t('home.cta.title')}</h2>
          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-orange-50 font-medium drop-shadow">
            {t('home.cta.subtitle')}
          </p>
          <Link href="/login">
            <Button size="lg" className="text-lg px-10 py-6 shadow-xl hover:shadow-2xl transition-shadow bg-white text-orange-700 hover:bg-orange-50">
              {t('home.cta.button')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
