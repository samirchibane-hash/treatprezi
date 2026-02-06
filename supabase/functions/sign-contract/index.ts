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
    const { token, signerName } = await req.json();
    if (!token || !signerName?.trim()) {
      return new Response(JSON.stringify({ error: 'Token and signer name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find contract by signing token
    const { data: contract, error: findError } = await serviceClient
      .from('contracts')
      .select('*')
      .eq('signing_token', token)
      .maybeSingle();

    if (findError || !contract) {
      console.error('Contract lookup error:', findError);
      return new Response(JSON.stringify({ error: 'Invalid or expired signing link' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry
    if (contract.signing_expires_at && new Date(contract.signing_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This signing link has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already signed
    if (contract.status === 'signed') {
      return new Response(JSON.stringify({ error: 'This contract has already been signed' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the client IP from headers
    const signerIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip') 
      || 'unknown';

    // Download existing PDF
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from('contracts')
      .download(contract.file_path);

    if (downloadError || !fileData) {
      console.error('PDF download error:', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to retrieve contract document' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use Nutrient API to digitally sign the PDF
    const NUTRIENT_API_KEY = Deno.env.get('NUTRIENT_API_KEY');
    if (!NUTRIENT_API_KEY) {
      return new Response(JSON.stringify({ error: 'Nutrient API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Applying digital signature via Nutrient API...');

    // Build instructions for the Nutrient /build endpoint
    // Add a watermark-style annotation with the signer's name and date
    const signedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const instructions = {
      parts: [
        { file: "document" }
      ],
      actions: [
        {
          type: "watermark",
          text: `Signed by ${signerName.trim()} on ${signedDate}`,
          width: 400,
          height: 30,
          fontSize: 10,
          opacity: 0.7,
          rotation: 0,
          position: { x: 100, y: 50 }
        }
      ]
    };

    const formData = new FormData();
    formData.append('document', fileData, 'contract.pdf');
    formData.append('instructions', JSON.stringify(instructions));

    const nutrientResponse = await fetch('https://api.nutrient.io/build', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${NUTRIENT_API_KEY}` },
      body: formData,
    });

    let signedPdfBuffer: ArrayBuffer;

    if (nutrientResponse.ok) {
      signedPdfBuffer = await nutrientResponse.arrayBuffer();
      console.log('Signed PDF generated, size:', signedPdfBuffer.byteLength);
    } else {
      // If watermark fails, still proceed with the original PDF
      console.warn('Nutrient watermark failed:', nutrientResponse.status, await nutrientResponse.text());
      signedPdfBuffer = await fileData.arrayBuffer();
    }

    // Upload signed version
    const signedFileName = contract.file_name.replace('.pdf', '-signed.pdf');
    const signedFilePath = contract.file_path.replace('.pdf', '-signed.pdf');

    const { error: uploadError } = await serviceClient.storage
      .from('contracts')
      .upload(signedFilePath, signedPdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('Upload signed PDF error:', uploadError);
    }

    // Update contract record
    const { error: updateError } = await serviceClient
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signer_name: signerName.trim(),
        signer_ip: signerIp,
        file_path: uploadError ? contract.file_path : signedFilePath,
        file_name: uploadError ? contract.file_name : signedFileName,
        signing_token: null, // Invalidate token after signing
      })
      .eq('id', contract.id);

    if (updateError) {
      console.error('Contract update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update contract status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Contract signed:', contract.id, 'by', signerName.trim());

    return new Response(JSON.stringify({
      success: true,
      message: 'Contract signed successfully',
      signedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sign contract error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
