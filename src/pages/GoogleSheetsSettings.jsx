import { useEffect, useState } from "react";
import { RefreshCw, UploadCloud, Save, Sheet, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function GoogleSheetsSettings() {
  const { role, loading: userLoading } = useCurrentUser();
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.GoogleSheetsConfig.list();
      setConfig(
        data[0] || {
          prices_spreadsheet_id: "",
          prices_sheet_name: "أسعار المواد",
          reports_spreadsheet_id: "",
          reports_sheet_name: "التقارير",
          auto_sync_enabled: false,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-10 text-center text-muted-foreground">
          هذه الصفحة متاحة للمدراء فقط
        </CardContent>
      </Card>
    );
  }

  const update = (field, value) =>
    setConfig((c) => ({ ...c, [field]: value }));

  const handleSave = async () => {
    if (!config.prices_spreadsheet_id || !config.reports_spreadsheet_id) {
      return toast({
        title: "أدخل معرّفي الملفين",
        variant: "destructive",
      });
    }
    setSaving(true);
    try {
      const payload = {
        prices_spreadsheet_id: config.prices_spreadsheet_id.trim(),
        prices_sheet_name: config.prices_sheet_name || "أسعار المواد",
        reports_spreadsheet_id: config.reports_spreadsheet_id.trim(),
        reports_sheet_name: config.reports_sheet_name || "التقارير",
        auto_sync_enabled: !!config.auto_sync_enabled,
      };
      if (config.id) {
        await base44.entities.GoogleSheetsConfig.update(config.id, payload);
      } else {
        await base44.entities.GoogleSheetsConfig.create(payload);
      }
      toast({ title: "تم حفظ الإعدادات" });
      load();
    } catch (e) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("syncMaterialPrices", {});
      setResult(res.data);
      toast({
        title: `تم تحديث ${res.data.updated} مادة`,
      });
      if (res.data.notFoundCount > 0) {
        toast({
          title: `${res.data.notFoundCount} مادة غير موجودة في النظام`,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "فشلت المزامنة",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("exportCostReports", {});
      setResult(res.data);
      toast({
        title: `تم تصدير ${res.data.exported} سجل إلى جوجل شيتس`,
      });
    } catch (e) {
      toast({
        title: "فشل التصدير",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Sheet className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">إعدادات مزامنة جوجل شيتس</h2>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              طريقة الحصول على معرّف الملف:
            </p>
            <p>
              افتح ملف جوجل شيتس في المتصفح، انسخ الجزء من الرابط بين
              <code className="mx-1 rounded bg-muted px-1">/d/</code>
              و
              <code className="mx-1 rounded bg-muted px-1">/edit</code>
            </p>
            <p className="font-medium text-foreground mt-2">
              ملف الأسعار:
            </p>
            <p>
              ورقة بعنوان
              <code className="mx-1 rounded bg-muted px-1">{config.prices_sheet_name || "أسعار المواد"}</code>
              تحتوي على عمودين: «اسم المادة» و«السعر». يجب أن تطابق الأسماء المواد في النظام.
            </p>
            <p className="font-medium text-foreground mt-2">
              ملف التقارير:
            </p>
            <p>
              ورقة بعنوان
              <code className="mx-1 rounded bg-muted px-1">{config.reports_sheet_name || "التقارير"}</code>
              — سيتم استبدال محتواها بالتقارير عند كل تصدير.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ملف أسعار المواد الخام</CardTitle>
          <CardDescription>تُقرأ الأسعار منه وتحدّث في النظام</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>معرّف الملف (Spreadsheet ID)</Label>
            <Input
              value={config.prices_spreadsheet_id}
              onChange={(e) => update("prices_spreadsheet_id", e.target.value)}
              placeholder="1AbC...XYZ"
              dir="ltr"
            />
          </div>
          <div className="grid gap-2">
            <Label>اسم ورقة التبويب</Label>
            <Input
              value={config.prices_sheet_name}
              onChange={(e) => update("prices_sheet_name", e.target.value)}
              placeholder="أسعار المواد"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ملف تصدير التقارير</CardTitle>
          <CardDescription>تُكتب فيه تقارير التكاليف</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>معرّف الملف (Spreadsheet ID)</Label>
            <Input
              value={config.reports_spreadsheet_id}
              onChange={(e) => update("reports_spreadsheet_id", e.target.value)}
              placeholder="1AbC...XYZ"
              dir="ltr"
            />
          </div>
          <div className="grid gap-2">
            <Label>اسم ورقة التبويب</Label>
            <Input
              value={config.reports_sheet_name}
              onChange={(e) => update("reports_sheet_name", e.target.value)}
              placeholder="التقارير"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">المزامنة التلقائية</CardTitle>
          <CardDescription>
            عند التفعيل تعمل ورشة مجدولة كل ساعة لتحديث الأسعار وتصدير التقارير
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={config.auto_sync_enabled}
              onCheckedChange={(v) => update("auto_sync_enabled", v)}
            />
            <Label className="text-sm">
              {config.auto_sync_enabled ? "مفعّلة" : "معطّلة"}
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="ml-1 h-4 w-4" />
          {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </Button>
        <Button
          variant="outline"
          onClick={handleSync}
          disabled={syncing || !config.id}
        >
          <RefreshCw className={`ml-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "جارٍ المزامنة..." : "مزامنة الأسعار الآن"}
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting || !config.id}
        >
          <UploadCloud className={`ml-1 h-4 w-4 ${exporting ? "animate-spin" : ""}`} />
          {exporting ? "جارٍ التصدير..." : "تصدير التقارير الآن"}
        </Button>
      </div>

      {result && (
        <Card>
          <CardContent className="py-4 text-sm">
            <pre
              dir="ltr"
              className="overflow-x-auto rounded-lg bg-muted p-3 text-xs"
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}