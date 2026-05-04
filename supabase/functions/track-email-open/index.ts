import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

serve(async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('uid');
    const emailType = url.searchParams.get('type');
    const testId = url.searchParams.get('test_id'); // A/B test ID
    const queueId = url.searchParams.get('qid');
    
    console.log(`[track-email-open] Request received: userId=${userId}, emailType=${emailType}, testId=${testId}`);
    
    if (userId && emailType) {
      // Create Supabase client with service role
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      if (queueId) {
        const openedAt = new Date().toISOString();

        const { data: queueRecord, error: queueFetchError } = await supabase
          .from('email_queue')
          .select('id, campaign_id, opened_at')
          .eq('id', queueId)
          .maybeSingle();

        if (queueFetchError) {
          console.error(`[track-email-open] Error fetching queue_id=${queueId}: ${queueFetchError.message}`);
        } else if (queueRecord && !queueRecord.opened_at) {
          await supabase
            .from('email_queue')
            .update({ opened_at: openedAt })
            .eq('id', queueId);

          await supabase
            .from('email_logs')
            .update({ opened_at: openedAt, status: 'aberto' })
            .eq('queue_id', queueId);

          if (queueRecord.campaign_id) {
            const { error: incrementError } = await supabase.rpc('increment_email_campaign_open', {
              p_campaign_id: queueRecord.campaign_id,
            });
            if (incrementError) {
              console.error(`[track-email-open] Error incrementing campaign opens: ${incrementError.message}`);
            }
          }

          await supabase.from('email_events').insert({
            campaign_id: queueRecord.campaign_id,
            queue_id: queueId,
            user_id: userId,
            email_type: emailType,
            event_type: 'open',
          });
        }
      }
      
      // Update onboarding_emails_sent table
      const { data: existingRecord, error: fetchError } = await supabase
        .from('onboarding_emails_sent')
        .select('id, sent_at, opened_at')
        .eq('user_id', userId)
        .eq('email_type', emailType)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();
      
      if (fetchError) {
        console.log(`[track-email-open] No record found for user=${userId}, type=${emailType}: ${fetchError.message}`);
      } else if (existingRecord) {
        // Only update if not already opened
        if (!existingRecord.opened_at) {
          const { error: updateError } = await supabase
            .from('onboarding_emails_sent')
            .update({ opened_at: new Date().toISOString() })
            .eq('id', existingRecord.id);
          
          if (updateError) {
            console.error(`[track-email-open] Error updating opened_at: ${updateError.message}`);
          } else {
            console.log(`[track-email-open] Email opened: user=${userId}, type=${emailType}, record_id=${existingRecord.id}`);
          }
        } else {
          console.log(`[track-email-open] Email already marked as opened: user=${userId}, type=${emailType}, opened_at=${existingRecord.opened_at}`);
        }
      }
      
      // Update A/B test results if test_id is provided
      if (testId) {
        const { data: abResult, error: abFetchError } = await supabase
          .from('email_ab_results')
          .select('id, opened_at')
          .eq('test_id', testId)
          .eq('user_id', userId)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();
        
        if (abFetchError) {
          console.log(`[track-email-open] No A/B result found for test_id=${testId}, user=${userId}: ${abFetchError.message}`);
        } else if (abResult && !abResult.opened_at) {
          const { error: abUpdateError } = await supabase
            .from('email_ab_results')
            .update({ opened_at: new Date().toISOString() })
            .eq('id', abResult.id);
          
          if (abUpdateError) {
            console.error(`[track-email-open] Error updating A/B result opened_at: ${abUpdateError.message}`);
          } else {
            console.log(`[track-email-open] A/B test opened: test_id=${testId}, user=${userId}`);
          }
        }
      }
    }
    
    // Return the tracking pixel
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[track-email-open] Error tracking email open:', error);
    // Always return the pixel even if tracking fails
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    });
  }
});
