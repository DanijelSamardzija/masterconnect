'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/lib/contexts/language-context';

export default function ContactPage() {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });

      if (!response.ok) throw new Error('Failed to submit message');

      setSubmitSuccess(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (error) {
      console.error('Contact form error:', error);
      setSubmitError('Failed to send message. Please try again or email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('contact.backToHome')}
            </Button>
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border-2 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('contact.title')}</h1>

          <p className="text-muted-foreground leading-relaxed mb-6">
            {t('contact.intro')}
          </p>

          <div className="flex items-center gap-2 mb-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
            <Mail className="h-5 w-5 text-orange-600" />
            <a
              href="mailto:support@platform.com"
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              support@platform.com
            </a>
          </div>

          {submitSuccess && (
            <Alert className="mb-6 border-green-200 bg-green-50 dark:bg-green-950/20">
              <AlertDescription className="text-green-800 dark:text-green-200">
                {t('contact.successMessage')}
              </AlertDescription>
            </Alert>
          )}

          {submitError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t('contact.nameLabel')}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t('contact.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('contact.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('contact.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{t('contact.messageLabel')}</Label>
              <Textarea
                id="message"
                placeholder={t('contact.messagePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                className="resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('contact.sending')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  {t('contact.submitButton')}
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
