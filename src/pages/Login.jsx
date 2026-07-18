import React, { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/",
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(err.message || "فشل تسجيل الدخول باستخدام حساب Google");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="مرحباً بك في نظام المصنع"
      subtitle="سجل الدخول باستخدام حساب جوجل للوصول للوحة التحكم"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      <Button
        variant="outline"
        className="w-full h-14 text-base font-semibold mb-6 flex items-center justify-center gap-3 shadow-sm hover:bg-slate-50 transition-colors"
        onClick={handleGoogle}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            جاري تحويلك...
          </>
        ) : (
          <>
            <GoogleIcon className="w-6 h-6" />
            الدخول المباشر بحساب Google
          </>
        )}
      </Button>
    </AuthLayout>
  );
}
