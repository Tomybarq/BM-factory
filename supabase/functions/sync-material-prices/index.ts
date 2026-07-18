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
  const nowStr = new Date().toISOString();

  try {
    const googleCredsStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!googleCredsStr) {
      const errMessage = 'لم يتم ضبط حساب الخدمة لجوجل (GOOGLE_SERVICE_ACCOUNT_JSON) في متغيرات البيئة';
      await supabase.from('SyncLog').insert({ action: 'sync', status: 'failed', error_details: errMessage });
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

    if (!config || !config.prices_spreadsheet_id) {
      const errMessage = 'لم يتم ضبط إعدادات جوجل شيتس بعد في قاعدة البيانات';
      await supabase.from('SyncLog').insert({ action: 'sync', status: 'failed', error_details: errMessage });
      return Response.json({ error: errMessage }, { status: 400 });
    }

    // Rate limiting check: prevent manually executing if last sync was < 1 minute ago to protect Google API quotas
    const { data: lastLogs } = await supabase
      .from('SyncLog')
      .select('created_at')
      .eq('action', 'sync')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (lastLogs?.[0]?.created_at) {
      const lastSyncTime = new Date(lastLogs[0].created_at).getTime();
      const diffMinutes = (Date.now() - lastSyncTime) / 60000;
      if (diffMinutes < 1) {
        return Response.json({ 
          error: 'يرجى الانتظار دقيقة واحدة على الأقل بين كل عملية مزامنة لحماية حصة الاتصالات الخاصة بـ Google API.' 
        }, { status: 429 });
      }
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
      await supabase.from('SyncLog').insert({ action: 'sync', status: 'failed', error_details: 'فشل قراءة الشيت من جوجل: ' + err });
      return Response.json({ error: 'فشل قراءة الشيت من جوجل: ' + err }, { status: 502 });
    }

    const data = await sheetRes.json();
    const rows = data.values || [];
    if (rows.length < 2) {
      const errMessage = 'لا توجد بيانات كافية في شيت الأسعار';
      await supabase.from('SyncLog').insert({ action: 'sync', status: 'failed', error_details: errMessage });
      return Response.json({ error: errMessage }, { status: 400 });
    }

    // Fuzzy Matching for Headers (Case-insensitive & regex match)
    const headers = (rows[0] || []).map((h: any) => (h || '').toString().trim());
    const nameIdx = headers.findIndex((h: string) => /اسم|مادة|عنصر|name/i.test(h));
    const priceIdx = headers.findIndex((h: string) => /سعر|تكلفة|price|cost/i.test(h));

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

    const toUpdate = [];
    let unchanged = 0;
    const notFound = [];
    const suspicious = []; // Track skipped prices due to validation rules

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

      // Sanity Validation for Prices
      const currentPrice = Number(material.purchase_price) || 0;
      if (price <= 0) {
        suspicious.push({ name, price, reason: 'السعر يساوي صفر أو سالب' });
        continue;
      }
      
      // If previous price exists, check for unrealistic price spikes or drops (prevent typos)
      if (currentPrice > 0) {
        const spikeMultiplier = price / currentPrice;
        if (spikeMultiplier > 5 || spikeMultiplier < 0.1) {
          suspicious.push({ 
            name, 
            price, 
            currentPrice, 
            reason: `تغير غير طبيعي (السعر الجديد ${price} والسابق ${currentPrice})` 
          });
          continue;
        }
      }

      if (currentPrice === price) {
        unchanged++;
        continue;
      }

      const history = Array.isArray(material.price_history) ? material.price_history : [];
      history.push({ price: currentPrice, date: nowStr });
      toUpdate.push({
        id: material.id,
        name: material.name,
        unit: material.unit,
        purchase_price: price,
        price_history: history,
        updated_date: nowStr
      });
    }

    if (toUpdate.length > 0) {
      const { error: updateErr } = await supabase
        .from('RawMaterial')
        .upsert(toUpdate);
      if (updateErr) throw updateErr;
    }

    const logSummary = `نجاح المزامنة: تحديث ${toUpdate.length} مادة، لم يتغير ${unchanged}، لم يُعثر على ${notFound.length}، مستبعد للتحقق ${suspicious.length}`;
    await supabase.from('SyncLog').insert({
      action: 'sync',
      status: 'success',
      summary: logSummary,
      error_details: suspicious.length > 0 ? JSON.stringify(suspicious) : null
    });

    return new Response(JSON.stringify({
      updated: toUpdate.length,
      unchanged,
      notFoundCount: notFound.length,
      notFound,
      suspiciousCount: suspicious.length,
      suspicious,
      totalRows: rows.length - 1,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error: any) {
    console.error('Migration execution crashed:', error);
    await supabase.from('SyncLog').insert({
      action: 'sync',
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
