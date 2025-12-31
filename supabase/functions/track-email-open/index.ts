import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      
      // Update the onboarding_emails_sent record to mark as opened
      // First check if a record exists for this user/email_type
      const { data: existingRecord } = await supabase
        .from('onboarding_emails_sent')
        .select('id, sent_at')
        .eq('user_id', userId)
        .eq('email_type', emailType)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();
      
      if (existingRecord) {
        // Log the open event (we could add an opened_at column later if needed)
        console.log(`Email opened: user=${userId}, type=${emailType}, sent_at=${existingRecord.sent_at}`);
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
    console.error('Error tracking email open:', error);
    // Always return the pixel even if tracking fails
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    });
  }
});
