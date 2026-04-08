import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const postType = request.nextUrl.searchParams.get('post_type');

    let query = supabase
      .from('posts')
      .select('category')
      .not('category', 'is', null)
      .neq('category', '');

    if (postType) {
      query = query.eq('post_type', postType);
    }

    const { data: postsData, error: postsError } = await query;

    if (postsError) {
      throw postsError;
    }

    const categories = new Set<string>();

    if (postsData) {
      postsData.forEach((post) => {
        if (post.category) {
          categories.add(post.category.trim());
        }
      });
    }

    const sortedCategories = Array.from(categories).sort((a, b) =>
      a.localeCompare(b, 'sr', { sensitivity: 'base' })
    );

    return NextResponse.json({ categories: sortedCategories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
