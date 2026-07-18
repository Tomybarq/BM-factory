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
    if (!config || !config.reports_spreadsheet_id) {
      return Response.json({ error: 'لم يتم ضبط إعدادات جوجل شيتس بعد' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const spreadsheetId = config.reports_spreadsheet_id;
    const sheetName = config.reports_sheet_name || 'التقارير';
    const encSheet = encodeURIComponent(sheetName);

    const calculations = await base44.asServiceRole.entities.Calculation.list('-created_date', 1000);

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
    for (const c of calculations) {
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
    } catch (_e) {
      // ignore clear errors
    }

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encSheet}!A1?valueInputOption=RAW`;
    const writeRes = await fetch(writeUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });

    if (!writeRes.ok) {
      const err = await writeRes.text();
      return Response.json({ error: 'فشل الكتابة للشيت: ' + err }, { status: 502 });
    }

    return Response.json({ exported: calculations.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});