import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, defaultRouteFor, type Role } from "@/lib/auth";
import { CopyrightFooter } from "@/components/footer";
import { Droplets, Loader2, UserCog, ClipboardList, Wallet, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "الدخول — منصة ميزان لإدارة المياه" },
      {
        name: "description",
        content:
          "دخول سريع إلى منصة ميزان — اختر دورك: مدير مشروع، قارئ عدادات، أو محصل.",
      },
      { property: "og:title", content: "الدخول — منصة ميزان لإدارة المياه" },
      {
        property: "og:description",
        content: "دخول سريع بحساب المشروع (مدير / قارئ عدادات / محصل).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type QuickAccount = {
  key: Role;
  label: string;
  hint: string;
  username: string;
  icon: typeof UserCog;
};

const ACCOUNTS: QuickAccount[] = [
  {
    key: "manager",
    label: "مدير مشروع",
    hint: "إدارة كاملة للمشروع والتقارير والمستخدمين",
    username: "manager",
    icon: UserCog,
  },
  {
    key: "reader",
    label: "قارئ عدادات",
    hint: "إدخال قراءات العدادات الميدانية",
    username: "reader",
    icon: ClipboardList,
  },
  {
    key: "collector",
    label: "محصل",
    hint: "إصدار الفواتير وتحصيل المدفوعات",
    username: "collector",
    icon: Wallet,
  },
];

function useQuickLogin() {
  const { loginWithIdentifier } = useAuth();
  const [selectedAccount, setSelectedAccount] = useState<QuickAccount | null>(null);
  const [quickPassword, setQuickPassword] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);

  async function pickAccount(acc: QuickAccount) {
    setSelectedAccount(acc);
    setQuickPassword("");
  }

  async function submitQuickLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccount || quickBusy) return;
    setQuickBusy(true);
    try {
      const ok = await loginWithIdentifier(selectedAccount.username, quickPassword);
      if (!ok) {
        toast.error("تعذر الدخول — تحقق من كلمة المرور");
      }
    } finally {
      setQuickBusy(false);
    }
  }

  return {
    selectedAccount,
    quickPassword,
    setQuickPassword,
    quickBusy,
    pickAccount,
    submitQuickLogin,
    cancel: () => setSelectedAccount(null),
  };
}

function LoginPage() {
  const navigate = useNavigate();
  const { user, loginWithIdentifier, loginError } = useAuth();
  const {
    selectedAccount,
    quickPassword,
    setQuickPassword,
    quickBusy,
    pickAccount,
    submitQuickLogin,
    cancel,
  } = useQuickLogin();
  const [manualUsername, setManualUsername] = useState("");
  const [manualPassword, setManualPassword] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    navigate({ to: defaultRouteFor(user.role), replace: true });
  }, [user, navigate]);

  async function manualLogin(e: React.FormEvent) {
    e.preventDefault();
    if (manualBusy) return;
    setManualBusy(true);
    try {
      const ok = await loginWithIdentifier(manualUsername.trim(), manualPassword);
      if (!ok) {
        const msg =
          loginError === "device_limit_exceeded"
            ? "تم تجاوز الحد المسموح من الأجهزة لهذا الحساب"
            : "اسم المستخدم أو كلمة المرور غير صحيحة";
        toast.error(msg);
      } else {
        toast.success("تم الدخول بنجاح");
      }
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted"
      dir="rtl"
    >
      <div className="flex-1 grid place-items-center px-4 py-10">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div
              className="mx-auto w-14 h-14 rounded-2xl grid place-items-center mb-2"
              style={{ background: "linear-gradient(135deg, var(--water) 0%, #0ea5e9 100%)" }}
            >
              <Droplets className="w-7 h-7 text-white" />
            </div>
            <CardTitle className="text-2xl">منصة ميزان</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              سجّل الدخول بحسابك أو اختر دوراً للدخول المباشر
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={manualLogin} className="space-y-3 mb-4">
              <div>
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username"
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                  placeholder="اسم المستخدم أو البريد"
                  autoComplete="username"
                />
              </div>
              <div>
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={manualBusy}>
                {manualBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin ms-1" />
                ) : (
                  <KeyRound className="w-4 h-4 ms-1" />
                )}
                دخول
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">أو دخول سريع</span>
              </div>
            </div>

            <div className="space-y-3">
              {ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                const isSelected = selectedAccount?.key === acc.key;
                const disabled = quickBusy || manualBusy;
                return (
                  <Button
                    key={acc.key}
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full h-auto justify-start gap-3 py-3 px-4"
                    onClick={() => pickAccount(acc)}
                    disabled={disabled}
                  >
                    <div
                      className="w-10 h-10 shrink-0 rounded-xl grid place-items-center text-white"
                      style={{ background: "linear-gradient(135deg, var(--water) 0%, #0ea5e9 100%)" }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-start flex-1">
                      <div className="font-bold text-base">{acc.label}</div>
                      <div className="text-[11px] text-muted-foreground font-normal">
                        {acc.hint}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>

            {selectedAccount && (
              <form onSubmit={submitQuickLogin} className="mt-3 p-3 rounded-lg border bg-muted/30 space-y-2">
                <Label htmlFor="quick-password">
                  كلمة مرور {selectedAccount.label}
                </Label>
                <Input
                  id="quick-password"
                  type="password"
                  value={quickPassword}
                  onChange={(e) => setQuickPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={quickBusy}>
                    {quickBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "دخول"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={cancel} disabled={quickBusy}>
                    إلغاء
                  </Button>
                </div>
              </form>
            )}

            <p className="text-[11px] text-muted-foreground text-center pt-4">
              اختر دوراً ثم أدخل كلمة المرور الخاصة به.
            </p>
          </CardContent>
        </Card>
      </div>
      <CopyrightFooter />
    </div>
  );
}
