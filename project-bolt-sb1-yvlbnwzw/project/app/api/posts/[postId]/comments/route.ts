import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

const json = (data: any, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const supabase = createClientFromRequest(req);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('[Comments API] Auth error:', authError);
    return json({ error: "Unauthorized" }, 401);
  }

  const { data, error } = await supabase
    .from("post_comments")
    .select("*, profiles(id, name)")
    .eq("post_id", params.postId)
    .order("created_at", { ascending: true });

  if (error) return json({ error: error.message }, 500);
  return json({ data }, 200);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const supabase = createClientFromRequest(req);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('[Comments API POST] Auth error:', authError);
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const text = String(body?.text ?? "").trim();
  if (!text) return json({ error: "Text is required" }, 400);

  const insertData: any = {
    post_id: params.postId,
    user_id: user.id,
    text,
  };

  if (body?.parentCommentId) {
    insertData.parent_comment_id = body.parentCommentId;
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert(insertData)
    .select("*, profiles(id, name)")
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ data }, 201);
}
