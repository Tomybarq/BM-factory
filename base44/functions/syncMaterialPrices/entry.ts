import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — للمدراء فقط' }, { status: 403 });
    }

    const configs = await base44.asServiceRole.entities.GoogleSheetsConfig.list();
    const config = configs[0];
    if (!config || !config.prices_spreadsheet_id) {
      return Response.json({ error: 'لم يتم ضبط إعدادات جوجل شيتس بعد' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const spreadsheetId = config.prices_spreadsheet_id;
    const sheetName = config.prices_sheet_name || 'أسعار المواد';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:Z`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: 'فشل قراءة الشيت: ' + err }, { status: 502 });
    }
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length < 2) {
      return Response.json({ error: 'لا توجد بيانات في الشيت' }, { status: 400 });
    }

    // First row = headers; locate name and price columns
    const headers = (rows[0] || []).map((h) => (h || '').toString().trim());
    const nameIdx =
      headers.findIndex((h) => h.includes('اسم') || h.toLowerCase().includes('name')) >= 0
        ? headers.findIndex((h) => h.includes('اسم') || h.toLowerCase().includes('name'))
        : 0;
    const priceIdx =
      headers.findIndex((h) => h.includes('السعر') || h.toLowerCase().includes('price')) >= 0
        ? headers.findIndex((h) => h.includes('السعر') || h.toLowerCase().includes('price'))
        : 1;

    const materials = await base44.asServiceRole.entities.RawMaterial.list(1000);
    const byName = {};
    for (const m of materials) {
      byName[(m.name || '').trim()] = m;
    }

    const now = new Date().toISOString();
    const toUpdate = [];
    let unchanged = 0;
    const notFound = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const name = (row[nameIdx] || '').toString().trim();
      const priceStr = (row[priceIdx] || '').toString().trim();
      const price = parseFloat(priceStr);
      if (!name || isNaN(price)) continue;
      const material = byName[name];
      if (!material) {
        notFound.push(name);
        continue;
      }
      if (material.purchase_price === price) {
        unchanged++;
        continue;
      }
      const history = Array.isArray(material.price_history) ? material.price_history : [];
      history.push({ price: material.purchase_price, date: now });
      toUpdate.push({ id: material.id, purchase_price: price, price_history: history });
    }

    if (toUpdate.length > 0) {
      await base44.asServiceRole.entities.RawMaterial.bulkUpdate(toUpdate);
    }

    return Response.json({
      updated: toUpdate.length,
      unchanged,
      notFoundCount: notFound.length,
      notFound,
      totalRows: rows.length - 1,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});