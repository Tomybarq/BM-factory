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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleCredsStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');

    if (!googleCredsStr) {
      return Response.json({ error: 'لم يتم ضبط حساب الخدمة لجوجل (GOOGLE_SERVICE_ACCOUNT_JSON) في متغيرات البيئة' }, { status: 400 });
    }

    const googleCreds = JSON.parse(googleCredsStr);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch sheets config
    const { data: configs, error: configErr } = await supabase
      .from('GoogleSheetsConfig')
      .select('*')
      .limit(1);

    if (configErr) throw configErr;
    const config = configs?.[0];

    if (!config || !config.prices_spreadsheet_id) {
      return Response.json({ error: 'لم يتم ضبط إعدادات جوجل شيتس بعد في قاعدة البيانات' }, { status: 400 });
    }

    // Get Access token and fetch sheet
    const accessToken = await getAccessToken(googleCreds);
    const spreadsheetId = config.prices_spreadsheet_id;
    const sheetName = config.prices_sheet_name || 'أسعار المواد';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:Z`;

    const sheetRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!sheetRes.ok) {
      const err = await sheetRes.text();
      return Response.json({ error: 'فشل قراءة الشيت من جوجل: ' + err }, { status: 502 });
    }

    const data = await sheetRes.json();
    const rows = data.values || [];
    if (rows.length < 2) {
      return Response.json({ error: 'لا توجد بيانات كافية في الشيت' }, { status: 400 });
    }

    // Parse headers
    const headers = (rows[0] || []).map((h: any) => (h || '').toString().trim());
    const nameIdx = headers.findIndex((h: string) => h.includes('اسم') || h.toLowerCase().includes('name'));
    const priceIdx = headers.findIndex((h: string) => h.includes('السعر') || h.toLowerCase().includes('price'));

    const nameColumn = nameIdx >= 0 ? nameIdx : 0;
    const priceColumn = priceIdx >= 0 ? priceIdx : 1;

    // Get existing materials
    const { data: materials, error: materialsErr } = await supabase
      .from('RawMaterial')
      .select('*');

    if (materialsErr) throw materialsErr;

    const byName: Record<string, any> = {};
    for (const m of (materials || [])) {
      byName[(m.name || '').trim()] = m;
    }

    const now = new Date().toISOString();
    const toUpdate = [];
    let unchanged = 0;
    const notFound = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const name = (row[nameColumn] || '').toString().trim();
      const priceStr = (row[priceColumn] || '').toString().trim();
      const price = parseFloat(priceStr);
      if (!name || isNaN(price)) continue;

      const material = byName[name];
      if (!material) {
        notFound.push(name);
        continue;
      }

      if (Number(material.purchase_price) === price) {
        unchanged++;
        continue;
      }

      const history = Array.isArray(material.price_history) ? material.price_history : [];
      history.push({ price: Number(material.purchase_price) || 0, date: now });
      toUpdate.push({
        id: material.id,
        name: material.name, // keep name to avoid RLS/constraints issue if any
        unit: material.unit, // required
        purchase_price: price,
        price_history: history,
        updated_date: now
      });
    }

    if (toUpdate.length > 0) {
      const { error: updateErr } = await supabase
        .from('RawMaterial')
        .upsert(toUpdate);
      if (updateErr) throw updateErr;
    }

    return new Response(JSON.stringify({
      updated: toUpdate.length,
      unchanged,
      notFoundCount: notFound.length,
      notFound,
      totalRows: rows.length - 1,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
});
