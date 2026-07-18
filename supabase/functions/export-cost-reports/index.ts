import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Helper function to get Google Access Token from Service Account JSON
async function getAccessToken(serviceAccountJson: any): Promise<string> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const scope = 'https://www.googleapis.com/auth/spreadsheets';
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccountJson.client_email,
    scope: scope,
    aud: tokenUrl,
    exp: now + 3600,
    iat: now
  };
  
  const encodeB64Url = (obj: any) => {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };
  
  const unsignedToken = `${encodeB64Url(header)}.${encodeB64Url(claimSet)}`;
  
  const privateKeyPem = serviceAccountJson.private_key;
  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsignedToken)
  );
  
  const jwt = `${unsignedToken}.${encodeB64Url(new Uint8Array(signature))}`;
  
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Failed to obtain Google access token: ' + err);
  }
  
  const tokenData = await res.json();
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const googleCredsStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!googleCredsStr) {
      const errMessage = 'لم يتم ضبط حساب الخدمة لجوجل (GOOGLE_SERVICE_ACCOUNT_JSON) في متغيرات البيئة';
      await supabase.from('SyncLog').insert({ action: 'export', status: 'failed', error_details: errMessage });
      return Response.json({ error: errMessage }, { status: 400 });
    }

    const googleCreds = JSON.parse(googleCredsStr);

    // Fetch sheets config
    const { data: configs, error: configErr } = await supabase
      .from('GoogleSheetsConfig')
      .select('*')
      .limit(1);

    if (configErr) throw configErr;
    const config = configs?.[0];

    if (!config || !config.reports_spreadsheet_id) {
      const errMessage = 'لم يتم ضبط إعدادات جوجل شيتس بعد في قاعدة البيانات';
      await supabase.from('SyncLog').insert({ action: 'export', status: 'failed', error_details: errMessage });
      return Response.json({ error: errMessage }, { status: 400 });
    }

    // Get Calculations (ordered by created_date descending)
    const { data: calculations, error: calcErr } = await supabase
      .from('Calculation')
      .select('*')
      .order('created_date', { ascending: false })
      .limit(1000); // safety cap limit to prevent out of memory issues

    if (calcErr) throw calcErr;

    const accessToken = await getAccessToken(googleCreds);
    const spreadsheetId = config.reports_spreadsheet_id;
    const sheetName = config.reports_sheet_name || 'التقارير';
    const encSheet = encodeURIComponent(sheetName);

    // Construct headers and rows
    const headers = [
      'التاريخ',
      'المنتج',
      'حجم التعبئة',
      'تكلفة المواد الخام',
      'تكلفة التعبئة',
      'تكلفة يدوية',
      'التكلفة الإجمالية',
      'التكلفة/لتر',
    ];
    const values = [headers];

    for (const c of (calculations || [])) {
      values.push([
        c.created_date ? new Date(c.created_date).toLocaleString('ar-EG') : '',
        c.product_name || '',
        c.packaging_size || '',
        c.raw_material_cost || 0,
        c.packaging_cost || 0,
        c.manual_cost || 0,
        c.total_cost || 0,
        c.cost_per_liter || 0,
      ]);
    }

    // Clear existing data
    try {
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encSheet}!A:Z:clear`;
      await fetch(clearUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('Ignore clear sheet error:', e);
    }

    // Write values
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encSheet}!A1?valueInputOption=RAW`;
    const writeRes = await fetch(writeUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });

    if (!writeRes.ok) {
      const err = await writeRes.text();
      await supabase.from('SyncLog').insert({ action: 'export', status: 'failed', error_details: 'فشل التصدير لجوجل شيت: ' + err });
      return Response.json({ error: 'فشل التصدير لجوجل شيت: ' + err }, { status: 502 });
    }

    const logSummary = `نجاح التصدير: تم تصدير ${values.length - 1} سجل حسابي إلى شيت التقارير`;
    await supabase.from('SyncLog').insert({
      action: 'export',
      status: 'success',
      summary: logSummary
    });

    return new Response(JSON.stringify({ exported: values.length - 1 }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error: any) {
    console.error('Export execution crashed:', error);
    await supabase.from('SyncLog').insert({
      action: 'export',
      status: 'failed',
      error_details: error.message || 'Unknown crash'
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
});
