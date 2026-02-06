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

    const { proposalId, templateId } = await req.json();
    if (!proposalId) {
      return new Response(JSON.stringify({ error: 'proposalId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch proposal
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

    // Fetch dealership & rep info
    const [{ data: dealership }, { data: repProfile }] = await Promise.all([
      supabase.from('dealerships').select('name, address, phone').eq('id', proposal.dealership_id).maybeSingle(),
      supabase.from('profiles').select('full_name, email, phone').eq('user_id', proposal.created_by).maybeSingle(),
    ]);

    // Fetch template - use specified, or default, or built-in
    let templateHtml: string | null = null;
    let usedTemplateId: string | null = null;

    if (templateId) {
      const { data: template } = await supabase
        .from('contract_templates')
        .select('id, html_content')
        .eq('id', templateId)
        .maybeSingle();
      if (template) {
        templateHtml = template.html_content;
        usedTemplateId = template.id;
      }
    }

    if (!templateHtml) {
      // Try default template for the dealership
      const { data: defaultTemplate } = await supabase
        .from('contract_templates')
        .select('id, html_content')
        .eq('dealership_id', proposal.dealership_id)
        .eq('is_default', true)
        .maybeSingle();
      if (defaultTemplate) {
        templateHtml = defaultTemplate.html_content;
        usedTemplateId = defaultTemplate.id;
      }
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // Build water test section
    const waterTests: string[] = [];
    if (proposal.hardness !== null) waterTests.push(`<tr><td>Hardness</td><td>${proposal.hardness} gpg</td></tr>`);
    if (proposal.iron !== null) waterTests.push(`<tr><td>Iron</td><td>${proposal.iron} ppm</td></tr>`);
    if (proposal.tds !== null) waterTests.push(`<tr><td>TDS</td><td>${proposal.tds} ppm</td></tr>`);
    if (proposal.ph !== null) waterTests.push(`<tr><td>pH Level</td><td>${proposal.ph}</td></tr>`);
    if (proposal.chlorine !== null) waterTests.push(`<tr><td>Chlorine</td><td>${proposal.chlorine} ppm</td></tr>`);

    const waterTestSection = waterTests.length > 0
      ? `<h2>Water Test Results</h2><table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>${waterTests.join('')}</tbody></table>`
      : '';

    // Build household section
    const householdRows: string[] = [];
    if (proposal.home_age) householdRows.push(`<tr><td>Home Age</td><td>${proposal.home_age}</td></tr>`);
    if (proposal.household_size) householdRows.push(`<tr><td>Household Size</td><td>${proposal.household_size}</td></tr>`);
    if (proposal.water_source) householdRows.push(`<tr><td>Water Source</td><td>${proposal.water_source}</td></tr>`);
    if (proposal.num_bathrooms) householdRows.push(`<tr><td>Bathrooms</td><td>${proposal.num_bathrooms}</td></tr>`);
    if (proposal.num_showers) householdRows.push(`<tr><td>Showers</td><td>${proposal.num_showers}</td></tr>`);

    const householdSection = householdRows.length > 0
      ? `<h2>Property Details</h2><table><thead><tr><th>Detail</th><th>Value</th></tr></thead><tbody>${householdRows.join('')}</tbody></table>`
      : '';

    const waterConcernsSection = proposal.water_concerns
      ? `<h2>Customer Concerns</h2><p>${proposal.water_concerns}</p>`
      : '';

    // Variable replacements
    const variables: Record<string, string> = {
      '{{company_name}}': dealership?.name || 'Water Treatment Services',
      '{{company_address}}': dealership?.address || '',
      '{{company_phone}}': dealership?.phone ? '• ' + dealership.phone : '',
      '{{customer_name}}': proposal.customer_name,
      '{{customer_address}}': proposal.address,
      '{{customer_email}}': proposal.customer_email || '',
      '{{customer_phone}}': proposal.customer_phone || '',
      '{{rep_name}}': repProfile?.full_name || 'N/A',
      '{{rep_email}}': repProfile?.email || '',
      '{{rep_phone}}': repProfile?.phone || '',
      '{{recommended_system}}': proposal.recommended_system,
      '{{date}}': today,
      '{{household_section}}': householdSection,
      '{{water_test_section}}': waterTestSection,
      '{{water_concerns_section}}': waterConcernsSection,
    };

    let html: string;

    if (templateHtml) {
      // Use custom template with variable replacement
      html = templateHtml;
      Object.entries(variables).forEach(([key, value]) => {
        html = html.replaceAll(key, value);
      });
    } else {
      // Fall back to built-in template
      html = buildDefaultHtml(variables);
    }

    // Call Nutrient API
    const NUTRIENT_API_KEY = Deno.env.get('NUTRIENT_API_KEY');
    if (!NUTRIENT_API_KEY) {
      return new Response(JSON.stringify({ error: 'Nutrient API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating PDF via Nutrient API...');

    const formData = new FormData();
    formData.append('index.html', new Blob([html], { type: 'text/html' }), 'index.html');
    formData.append('instructions', JSON.stringify({
      parts: [{ html: 'index.html' }],
    }));

    const nutrientResponse = await fetch('https://api.nutrient.io/build', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${NUTRIENT_API_KEY}` },
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
    console.log('PDF generated, size:', pdfBuffer.byteLength);

    // Upload to storage
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const fileName = `contract-${proposal.customer_name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;
    const filePath = `${proposal.dealership_id}/${proposalId}/${fileName}`;

    const { error: uploadError } = await serviceClient.storage
      .from('contracts')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to save contract' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate signing token
    const signingToken = crypto.randomUUID();
    const signingExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

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
        template_id: usedTemplateId,
        signing_token: signingToken,
        signing_expires_at: signingExpiresAt,
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

    const { data: signedUrl } = await serviceClient.storage
      .from('contracts')
      .createSignedUrl(filePath, 3600);

    console.log('Contract created:', contract.id);

    return new Response(JSON.stringify({
      contract: { ...contract },
      downloadUrl: signedUrl?.signedUrl,
      signingToken,
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

function buildDefaultHtml(v: Record<string, string>): string {
  return `<!DOCTYPE html>
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
  <div class="header"><h1>${v['{{company_name}}']}</h1><p>${v['{{company_address}}']} ${v['{{company_phone}}']}</p></div>
  <p class="date">Date: ${v['{{date}}']}</p>
  <div class="meta">
    <div class="meta-box"><h3>Customer</h3><p><strong>${v['{{customer_name}}']}</strong></p><p>${v['{{customer_address}}']}</p>${v['{{customer_email}}'] ? `<p>${v['{{customer_email}}']}</p>` : ''}${v['{{customer_phone}}'] ? `<p>${v['{{customer_phone}}']}</p>` : ''}</div>
    <div class="meta-box"><h3>Sales Representative</h3><p><strong>${v['{{rep_name}}']}</strong></p>${v['{{rep_email}}'] ? `<p>${v['{{rep_email}}']}</p>` : ''}${v['{{rep_phone}}'] ? `<p>${v['{{rep_phone}}']}</p>` : ''}</div>
  </div>
  <div class="system-box"><h3>Recommended System</h3><p>${v['{{recommended_system}}']}</p></div>
  ${v['{{household_section}}']}
  ${v['{{water_test_section}}']}
  ${v['{{water_concerns_section}}']}
  <div class="signature-section">
    <h2>Agreement</h2>
    <p>By signing below, the customer acknowledges and agrees to the installation of the recommended water treatment system at the service address listed above.</p>
    <div class="sig-line">
      <div class="sig-block"><div class="line"></div><p><strong>Customer Signature</strong></p><p>${v['{{customer_name}}']}</p><p>Date: _______________</p></div>
      <div class="sig-block"><div class="line"></div><p><strong>Company Representative</strong></p><p>${v['{{rep_name}}']}</p><p>Date: _______________</p></div>
    </div>
  </div>
  <div class="terms"><p>This contract is subject to the standard terms and conditions of ${v['{{company_name}}']}. Installation scheduling will be confirmed upon receipt of signed agreement.</p></div>
</body>
</html>`;
}
