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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { proposalId } = await req.json();
    if (!proposalId) {
      return new Response(JSON.stringify({ error: 'proposalId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch proposal with dealership info
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .maybeSingle();

    if (proposalError || !proposal) {
      console.error('Proposal fetch error:', proposalError);
      return new Response(JSON.stringify({ error: 'Proposal not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch dealership info
    const { data: dealership } = await supabase
      .from('dealerships')
      .select('name, address, phone')
      .eq('id', proposal.dealership_id)
      .maybeSingle();

    // Fetch rep info
    const { data: repProfile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('user_id', proposal.created_by)
      .maybeSingle();

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // Build water test section
    const waterTests = [];
    if (proposal.hardness !== null) waterTests.push(`<tr><td>Hardness</td><td>${proposal.hardness} gpg</td></tr>`);
    if (proposal.iron !== null) waterTests.push(`<tr><td>Iron</td><td>${proposal.iron} ppm</td></tr>`);
    if (proposal.tds !== null) waterTests.push(`<tr><td>TDS</td><td>${proposal.tds} ppm</td></tr>`);
    if (proposal.ph !== null) waterTests.push(`<tr><td>pH Level</td><td>${proposal.ph}</td></tr>`);
    if (proposal.chlorine !== null) waterTests.push(`<tr><td>Chlorine</td><td>${proposal.chlorine} ppm</td></tr>`);

    const waterTestSection = waterTests.length > 0
      ? `<h2>Water Test Results</h2><table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>${waterTests.join('')}</tbody></table>`
      : '';

    // Build household section
    const householdRows = [];
    if (proposal.home_age) householdRows.push(`<tr><td>Home Age</td><td>${proposal.home_age}</td></tr>`);
    if (proposal.household_size) householdRows.push(`<tr><td>Household Size</td><td>${proposal.household_size}</td></tr>`);
    if (proposal.water_source) householdRows.push(`<tr><td>Water Source</td><td>${proposal.water_source}</td></tr>`);
    if (proposal.num_bathrooms) householdRows.push(`<tr><td>Bathrooms</td><td>${proposal.num_bathrooms}</td></tr>`);
    if (proposal.num_showers) householdRows.push(`<tr><td>Showers</td><td>${proposal.num_showers}</td></tr>`);

    const householdSection = householdRows.length > 0
      ? `<h2>Property Details</h2><table><thead><tr><th>Detail</th><th>Value</th></tr></thead><tbody>${householdRows.join('')}</tbody></table>`
      : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: letter; margin: 1in; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 11pt; }
  .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #0077b6; padding-bottom: 20px; }
  .header h1 { color: #0077b6; margin: 0; font-size: 24pt; }
  .header p { color: #666; margin: 5px 0 0; font-size: 10pt; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .meta-box { background: #f8f9fa; border-radius: 8px; padding: 15px; width: 48%; }
  .meta-box h3 { margin: 0 0 8px; color: #0077b6; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; }
  .meta-box p { margin: 3px 0; font-size: 10pt; }
  h2 { color: #0077b6; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; font-size: 14pt; margin-top: 30px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e8e8e8; font-size: 10pt; }
  th { background: #f0f7ff; color: #0077b6; font-weight: 600; }
  .system-box { background: #f0f7ff; border: 2px solid #0077b6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
  .system-box h3 { color: #0077b6; margin: 0 0 5px; font-size: 14pt; }
  .system-box p { margin: 0; color: #666; font-size: 10pt; }
  .signature-section { margin-top: 60px; page-break-inside: avoid; }
  .sig-line { display: flex; justify-content: space-between; margin-top: 50px; }
  .sig-block { width: 45%; }
  .sig-block .line { border-top: 1px solid #333; padding-top: 5px; margin-top: 40px; }
  .sig-block p { margin: 3px 0; font-size: 9pt; color: #666; }
  .terms { font-size: 8pt; color: #888; margin-top: 40px; padding-top: 15px; border-top: 1px solid #e0e0e0; }
  .date { font-size: 10pt; color: #666; text-align: right; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${dealership?.name || 'Water Treatment Services'}</h1>
    <p>${dealership?.address || ''} ${dealership?.phone ? '• ' + dealership.phone : ''}</p>
  </div>

  <p class="date">Date: ${today}</p>

  <div class="meta">
    <div class="meta-box">
      <h3>Customer</h3>
      <p><strong>${proposal.customer_name}</strong></p>
      <p>${proposal.address}</p>
      ${proposal.customer_email ? `<p>${proposal.customer_email}</p>` : ''}
      ${proposal.customer_phone ? `<p>${proposal.customer_phone}</p>` : ''}
    </div>
    <div class="meta-box">
      <h3>Sales Representative</h3>
      <p><strong>${repProfile?.full_name || 'N/A'}</strong></p>
      ${repProfile?.email ? `<p>${repProfile.email}</p>` : ''}
      ${repProfile?.phone ? `<p>${repProfile.phone}</p>` : ''}
    </div>
  </div>

  <div class="system-box">
    <h3>Recommended System</h3>
    <p>${proposal.recommended_system}</p>
  </div>

  ${householdSection}
  ${waterTestSection}

  ${proposal.water_concerns ? `<h2>Customer Concerns</h2><p>${proposal.water_concerns}</p>` : ''}

  <div class="signature-section">
    <h2>Agreement</h2>
    <p>By signing below, the customer acknowledges and agrees to the installation of the recommended water treatment system at the service address listed above. The customer confirms that all information provided is accurate and agrees to the terms and conditions of service.</p>
    <div class="sig-line">
      <div class="sig-block">
        <div class="line"></div>
        <p><strong>Customer Signature</strong></p>
        <p>${proposal.customer_name}</p>
        <p>Date: _______________</p>
      </div>
      <div class="sig-block">
        <div class="line"></div>
        <p><strong>Company Representative</strong></p>
        <p>${repProfile?.full_name || ''}</p>
        <p>Date: _______________</p>
      </div>
    </div>
  </div>

  <div class="terms">
    <p>This contract is subject to the standard terms and conditions of ${dealership?.name || 'the company'}. Installation scheduling will be confirmed upon receipt of signed agreement. Warranty information will be provided at time of installation.</p>
  </div>
</body>
</html>`;

    // Call Nutrient API to generate PDF
    const NUTRIENT_API_KEY = Deno.env.get('NUTRIENT_API_KEY');
    if (!NUTRIENT_API_KEY) {
      return new Response(JSON.stringify({ error: 'Nutrient API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Calling Nutrient API to generate PDF...');

    const formData = new FormData();
    const htmlBlob = new Blob([html], { type: 'text/html' });
    formData.append('html', htmlBlob, 'index.html');

    const nutrientResponse = await fetch('https://api.nutrient.io/build', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NUTRIENT_API_KEY}`,
      },
      body: formData,
    });

    if (!nutrientResponse.ok) {
      const errorText = await nutrientResponse.text();
      console.error('Nutrient API error:', nutrientResponse.status, errorText);
      return new Response(JSON.stringify({ error: `PDF generation failed: ${nutrientResponse.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pdfBuffer = await nutrientResponse.arrayBuffer();
    console.log('PDF generated successfully, size:', pdfBuffer.byteLength);

    // Upload to Supabase Storage using service role
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const fileName = `contract-${proposal.customer_name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;
    const filePath = `${proposal.dealership_id}/${proposalId}/${fileName}`;

    const { error: uploadError } = await serviceClient.storage
      .from('contracts')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to save contract' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's profile for dealership_id
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('dealership_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Insert contract record
    const { data: contract, error: contractError } = await serviceClient
      .from('contracts')
      .insert({
        proposal_id: proposalId,
        dealership_id: proposal.dealership_id,
        file_path: filePath,
        file_name: fileName,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (contractError) {
      console.error('Contract insert error:', contractError);
      return new Response(JSON.stringify({ error: 'Failed to save contract record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Contract created:', contract.id);

    // Generate a signed URL for download
    const { data: signedUrl } = await serviceClient.storage
      .from('contracts')
      .createSignedUrl(filePath, 3600); // 1 hour

    return new Response(JSON.stringify({
      contract,
      downloadUrl: signedUrl?.signedUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate contract error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
