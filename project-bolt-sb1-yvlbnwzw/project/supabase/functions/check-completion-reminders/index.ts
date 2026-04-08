import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: overdueJobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, completion_requested_at")
      .eq("completion_requested", true)
      .is("completion_reminder_sent_at", null)
      .is("completion_request_dismissed_at", null)
      .neq("status", "completed")
      .lt("completion_requested_at", twentyFourHoursAgo.toISOString());

    if (jobsError) {
      console.error("Error fetching overdue jobs:", jobsError);
      throw jobsError;
    }

    const remindersCreated = [];

    for (const job of overdueJobs || []) {
      const { data: threads, error: threadError } = await supabase
        .from("threads")
        .select("id, customer_id, pro_id")
        .eq("job_id", job.id)
        .limit(1)
        .maybeSingle();

      if (threadError || !threads) {
        console.warn(`No thread found for job ${job.id}`);
        continue;
      }

      const threadId = threads.id;
      const customerId = threads.customer_id;
      const proId = threads.pro_id;

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          text: "⏰ Reminder: Please review the job and confirm completion (or decline if not finished).",
          is_system: true,
          sender_id: customerId,
          receiver_id: proId,
        });

      if (messageError) {
        console.error(`Error creating reminder message for job ${job.id}:`, messageError);
        continue;
      }

      const { error: updateError } = await supabase
        .from("jobs")
        .update({ completion_reminder_sent_at: new Date().toISOString() })
        .eq("id", job.id);

      if (updateError) {
        console.error(`Error updating job ${job.id}:`, updateError);
        continue;
      }

      remindersCreated.push({
        jobId: job.id,
        threadId: threadId,
        requestedAt: job.completion_requested_at,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        remindersCreated: remindersCreated.length,
        details: remindersCreated,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in check-completion-reminders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
