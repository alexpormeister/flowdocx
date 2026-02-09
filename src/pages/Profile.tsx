import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, updateProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, User, Save } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { BackgroundSettings } from "@/components/dashboard/BackgroundSettings";
import { toast } from "sonner";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setPhoneNumber(profile.phone_number || "");
      setAddress(profile.address || "");
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("profile.updated"));
    },
    onError: (error) => {
      toast.error((error as Error).message);
    },
  });

  const updateBackgroundMutation = useMutation({
    mutationFn: (backgroundUrl: string | null) =>
      updateProfile({ dashboard_background_url: backgroundUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      display_name: displayName,
      phone_number: phoneNumber,
      address: address,
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <User className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-semibold">{t("profile.title")}</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto py-6 sm:py-8 px-4">
        <div className="space-y-6">
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.title")}</CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">{t("auth.displayName")}</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("auth.displayName")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("profile.phoneNumber")}</Label>
                  <Input
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+358..."
                    type="tel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("profile.address")}</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t("profile.address")}
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full gap-2">
                <Save className="w-4 h-4" />
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.appearance")}</CardTitle>
              <CardDescription>{t("profile.appearanceDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>{t("profile.theme")}</Label>
                  <ThemeToggle />
                </div>
                <div className="flex items-center gap-2">
                  <Label>{t("profile.language")}</Label>
                  <LanguageToggle />
                </div>
              </div>

              {/* Background Settings inline */}
              {user && (
                <div className="space-y-2">
                  <Label>{t("background.title")}</Label>
                  <BackgroundSettings
                    currentBackground={profile?.dashboard_background_url || null}
                    onBackgroundChange={async (url) => {
                      await updateBackgroundMutation.mutateAsync(url);
                    }}
                    userId={user.id}
                    inline
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
