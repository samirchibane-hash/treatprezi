import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find contract by signing token
    const { data: contract, error } = await serviceClient
      .from('contracts')
      .select('id, file_path, file_name, status, signing_expires_at, proposal_id')
      .eq('signing_token', token)
      .maybeSingle();

    if (error || !contract) {
      return new Response(JSON.stringify({ error: 'Invalid signing link', valid: false }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (contract.status === 'signed') {
      return new Response(JSON.stringify({ error: 'Already signed', valid: false, alreadySigned: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (contract.signing_expires_at && new Date(contract.signing_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Signing link expired', valid: false, expired: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get proposal info for display
    const { data: proposal } = await serviceClient
      .from('proposals')
      .select('customer_name, address, recommended_system, dealership_id')
      .eq('id', contract.proposal_id)
      .maybeSingle();

    let companyName = 'Water Treatment Services';
    if (proposal?.dealership_id) {
      const { data: dealership } = await serviceClient
        .from('dealerships')
        .select('name')
        .eq('id', proposal.dealership_id)
        .maybeSingle();
      if (dealership) companyName = dealership.name;
    }

    // Generate a signed URL for PDF preview
    const { data: signedUrl } = await serviceClient.storage
      .from('contracts')
      .createSignedUrl(contract.file_path, 3600);

    return new Response(JSON.stringify({
      valid: true,
      contractId: contract.id,
      fileName: contract.file_name,
      pdfUrl: signedUrl?.signedUrl,
      customerName: proposal?.customer_name || 'Customer',
      companyName,
      address: proposal?.address,
      system: proposal?.recommended_system,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Verify signing token error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
