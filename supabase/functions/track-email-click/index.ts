import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('uid');
    const emailType = url.searchParams.get('type');
    const testId = url.searchParams.get('test_id');
    const redirectUrl = url.searchParams.get('redirect') || 'https://leadflux.digital';
    
    console.log(`[track-email-click] Click received: userId=${userId}, emailType=${emailType}, testId=${testId}, redirect=${redirectUrl}`);
    
    if (userId && emailType) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      
      // Update onboarding_emails_sent table if it has clicked_at column
      // For now, we'll just log it since the table doesn't have clicked_at
      console.log(`[track-email-click] CTA clicked by user=${userId}, type=${emailType}`);
      
      // Update A/B test results if test_id is provided
      if (testId) {
        const { data: abResult, error: abFetchError } = await supabase
          .from('email_ab_results')
          .select('id, clicked_at')
          .eq('test_id', testId)
          .eq('user_id', userId)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();
        
        if (abFetchError) {
          console.log(`[track-email-click] No A/B result found for test_id=${testId}, user=${userId}: ${abFetchError.message}`);
        } else if (abResult && !abResult.clicked_at) {
          const { error: abUpdateError } = await supabase
            .from('email_ab_results')
            .update({ clicked_at: new Date().toISOString() })
            .eq('id', abResult.id);
          
          if (abUpdateError) {
            console.error(`[track-email-click] Error updating A/B result clicked_at: ${abUpdateError.message}`);
          } else {
            console.log(`[track-email-click] A/B test click recorded: test_id=${testId}, user=${userId}`);
          }
        } else if (abResult?.clicked_at) {
          console.log(`[track-email-click] Click already recorded for test_id=${testId}, user=${userId}`);
        }
      }
    }
    
    // Redirect to the destination URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[track-email-click] Error tracking click:', error);
    // Still redirect even if tracking fails
    const url = new URL(req.url);
    const redirectUrl = url.searchParams.get('redirect') || 'https://leadflux.digital';
    return new Response(null, {
      status: 302,
      headers: { 'Location': redirectUrl },
    });
  }
});
