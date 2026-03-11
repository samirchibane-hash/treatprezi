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
    const { token, signerName, signatureImage } = await req.json();
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

    if (contract.signing_expires_at && new Date(contract.signing_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This signing link has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (contract.status === 'signed') {
      return new Response(JSON.stringify({ error: 'This contract has already been signed' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const NUTRIENT_API_KEY = Deno.env.get('NUTRIENT_API_KEY');
    if (!NUTRIENT_API_KEY) {
      return new Response(JSON.stringify({ error: 'Nutrient API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    let signedPdfBuffer: ArrayBuffer;

    if (signatureImage && signatureImage.startsWith('data:image/png;base64,')) {
      console.log('Processing wet signature — generating signature page PDF then merging...');

      // Step 1: Create a signature page as HTML with the drawn signature embedded
      const signaturePageHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: letter; margin: 1in; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; }
  .sig-page { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 80vh; text-align: center; }
  .sig-page h2 { color: #0077b6; font-size: 18pt; margin-bottom: 30px; }
  .sig-image { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 10px; }
  .sig-image img { max-width: 350px; height: auto; }
  .sig-name { font-size: 12pt; font-weight: 600; margin: 5px 0; }
  .sig-date { font-size: 10pt; color: #666; margin: 3px 0; }
  .sig-ip { font-size: 8pt; color: #999; margin-top: 15px; }
</style>
</head>
<body>
  <div class="sig-page">
    <h2>Customer Signature</h2>
    <div class="sig-image">
      <img src="${signatureImage}" alt="Customer Signature" />
    </div>
    <p class="sig-name">${signerName.trim()}</p>
    <p class="sig-date">Signed on ${signedDate}</p>
    <p class="sig-ip">IP: ${signerIp}</p>
  </div>
</body>
</html>`;

      // Step 2: Convert signature page HTML to PDF via Nutrient
      const sigFormData = new FormData();
      const sigHtmlBlob = new Blob([signaturePageHtml], { type: 'text/html' });
      sigFormData.append('index.html', sigHtmlBlob, 'index.html');
      sigFormData.append('instructions', JSON.stringify({
        parts: [{ html: 'index.html' }],
      }));

      console.log('Converting signature page HTML to PDF...');
      const sigPdfResponse = await fetch('https://api.nutrient.io/build', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${NUTRIENT_API_KEY}` },
        body: sigFormData,
      });

      if (!sigPdfResponse.ok) {
        const errText = await sigPdfResponse.text();
        console.error('Signature page PDF generation failed:', sigPdfResponse.status, errText);
        // Fall back to watermark-only approach
        signedPdfBuffer = await applyWatermarkOnly(fileData, signerName, signedDate, NUTRIENT_API_KEY);
      } else {
        const sigPdfBlob = await sigPdfResponse.blob();
        console.log('Signature page PDF generated, size:', sigPdfBlob.size);

        // Step 3: Merge contract + signature page
        const mergeFormData = new FormData();
        mergeFormData.append('contract', fileData, 'contract.pdf');
        mergeFormData.append('signature-page', sigPdfBlob, 'signature-page.pdf');
        mergeFormData.append('instructions', JSON.stringify({
          parts: [
            { file: 'contract' },
            { file: 'signature-page' },
          ],
          actions: [
            {
              type: 'watermark',
              text: `Signed by ${signerName.trim()} on ${signedDate}`,
              width: 400,
              height: 30,
              fontSize: 10,
              opacity: 0.7,
              rotation: 0,
              position: { x: 100, y: 50 },
            },
          ],
        }));

        console.log('Merging contract with signature page...');
        const mergeResponse = await fetch('https://api.nutrient.io/build', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${NUTRIENT_API_KEY}` },
          body: mergeFormData,
        });

        if (mergeResponse.ok) {
          signedPdfBuffer = await mergeResponse.arrayBuffer();
          console.log('Merged PDF generated, size:', signedPdfBuffer.byteLength);
        } else {
          const mergeErr = await mergeResponse.text();
          console.warn('Merge failed:', mergeResponse.status, mergeErr);
          signedPdfBuffer = await applyWatermarkOnly(fileData, signerName, signedDate, NUTRIENT_API_KEY);
        }
      }
    } else {
      // No drawn signature — just watermark
      console.log('Type-only signature, applying watermark...');
      signedPdfBuffer = await applyWatermarkOnly(fileData, signerName, signedDate, NUTRIENT_API_KEY);
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
        signing_token: null,
      })
      .eq('id', contract.id);

    if (updateError) {
      console.error('Contract update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update contract status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark the proposal as closed
    await serviceClient
      .from('proposals')
      .update({ stage: 'closed' })
      .eq('id', contract.proposal_id);

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

async function applyWatermarkOnly(
  fileData: Blob,
  signerName: string,
  signedDate: string,
  apiKey: string,
): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append('document', fileData, 'contract.pdf');
  formData.append('instructions', JSON.stringify({
    parts: [{ file: 'document' }],
    actions: [
      {
        type: 'watermark',
        text: `Signed by ${signerName.trim()} on ${signedDate}`,
        width: 400,
        height: 30,
        fontSize: 10,
        opacity: 0.7,
        rotation: 0,
        position: { x: 100, y: 50 },
      },
    ],
  }));

  const response = await fetch('https://api.nutrient.io/build', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (response.ok) {
    return await response.arrayBuffer();
  }

  console.warn('Watermark-only also failed:', response.status, await response.text());
  return await fileData.arrayBuffer();
}
