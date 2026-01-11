import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, LayoutDashboard, Globe, UtensilsCrossed, Clock, Save, Play } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface LogoLocation {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const LOGO_LOCATIONS: LogoLocation[] = [
  {
    key: "logo_sidebar",
    label: "Logo do Sidebar",
    description: "Aparece no menu lateral do dashboard (painel administrativo)",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    key: "logo_landing",
    label: "Logo da Landing Page",
    description: "Aparece na página inicial pública do sistema",
    icon: <Globe className="h-5 w-5" />,
  },
  {
    key: "logo_public_menu",
    label: "Logo do Menu Público",
    description: "Aparece no cardápio digital dos clientes (quando a loja não tem logo própria)",
    icon: <UtensilsCrossed className="h-5 w-5" />,
  },
];

export default function SystemSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [logos, setLogos] = useState<Record<string, string | null>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  
  // Inactivity settings
  const [inactivityDays, setInactivityDays] = useState<number>(15);
  const [savingInactivity, setSavingInactivity] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [navigate]);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Não autenticado");
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isSuperAdmin = roles?.some(r => r.role === "super_admin");
    if (!isSuperAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }

    setHasAccess(true);
    loadSettings();
  };

  const loadSettings = async () => {
    setLoading(true);
    const keys = [...LOGO_LOCATIONS.map(l => l.key), "inactivity_suspension_days"];
    
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", keys);

    if (error) {
      toast.error("Erro ao carregar configurações");
      console.error(error);
    } else {
      const logoMap: Record<string, string | null> = {};
      data?.forEach(item => {
        if (item.key === "inactivity_suspension_days") {
          setInactivityDays(parseInt(item.value || "15", 10));
        } else {
          logoMap[item.key] = item.value;
        }
      });
      setLogos(logoMap);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, locationKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploadingKey(locationKey);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${locationKey}-${Date.now()}.${fileExt}`;
      const filePath = `system/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);

      const newUrl = urlData.publicUrl;

      // Upsert in database
      const { error: upsertError } = await supabase
        .from("system_settings")
        .upsert(
          { key: locationKey, value: newUrl },
          { onConflict: "key" }
        );

      if (upsertError) throw upsertError;

      setLogos(prev => ({ ...prev, [locationKey]: newUrl }));
      toast.success("Logo atualizada com sucesso!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploadingKey(null);
      // Reset file input
      e.target.value = "";
    }
  };

  const handleRemoveLogo = async (locationKey: string) => {
    if (!confirm("Deseja remover esta logo?")) return;

    setRemovingKey(locationKey);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: null })
        .eq("key", locationKey);

      if (error) throw error;

      setLogos(prev => ({ ...prev, [locationKey]: null }));
      toast.success("Logo removida com sucesso");
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Erro ao remover logo");
    } finally {
      setRemovingKey(null);
    }
  };

  const handleSaveInactivityDays = async () => {
    if (inactivityDays < 1 || inactivityDays > 365) {
      toast.error("O período deve ser entre 1 e 365 dias");
      return;
    }

    setSavingInactivity(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          { key: "inactivity_suspension_days", value: inactivityDays.toString() },
          { onConflict: "key" }
        );

      if (error) throw error;
      toast.success("Configuração salva com sucesso!");
    } catch (error) {
      console.error("Error saving inactivity days:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSavingInactivity(false);
    }
  };

  const handleRunInactivityCheck = async () => {
    if (!confirm("Isso irá verificar e suspender empresas inativas agora. Deseja continuar?")) {
      return;
    }

    setRunningCheck(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-inactive-companies");

      if (error) throw error;

      if (data?.cancelled > 0) {
        toast.success(`Verificação concluída. ${data.cancelled} empresa(s) suspensa(s).`);
      } else {
        toast.success("Verificação concluída. Nenhuma empresa inativa encontrada.");
      }
    } catch (error: any) {
      console.error("Error running inactivity check:", error);
      toast.error("Erro ao executar verificação: " + (error.message || "Erro desconhecido"));
    } finally {
      setRunningCheck(false);
    }
  };

  if (loading || !hasAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Configure logos e outras opções gerais do sistema.
          </p>
        </div>

        {/* Inactivity Suspension Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg text-warning">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Suspensão por Inatividade</CardTitle>
                <CardDescription>
                  Empresas aprovadas que não receberam pedidos e não configuraram o cardápio serão suspensas automaticamente
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="inactivity-days">Período de inatividade (dias)</Label>
                <Input
                  id="inactivity-days"
                  type="number"
                  min={1}
                  max={365}
                  value={inactivityDays}
                  onChange={(e) => setInactivityDays(parseInt(e.target.value, 10) || 15)}
                  className="mt-1.5"
                />
              </div>
              <Button
                onClick={handleSaveInactivityDays}
                disabled={savingInactivity}
                size="sm"
              >
                {savingInactivity ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Empresas que permanecerem <strong>{inactivityDays} dias</strong> sem receber pedidos e sem configurar produtos/categorias serão suspensas automaticamente e receberão um email explicando o motivo.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleRunInactivityCheck}
                disabled={runningCheck}
                size="sm"
              >
                {runningCheck ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Executar verificação agora
              </Button>
              <span className="text-xs text-muted-foreground">
                Verifica e suspende empresas inativas imediatamente
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Logo Settings */}
        {LOGO_LOCATIONS.map((location) => {
          const logoUrl = logos[location.key];
          const isUploading = uploadingKey === location.key;
          const isRemoving = removingKey === location.key;
          const inputId = `logo-upload-${location.key}`;

          return (
            <Card key={location.key}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {location.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{location.label}</CardTitle>
                    <CardDescription>{location.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {logoUrl && (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <img
                      src={logoUrl}
                      alt={`Logo ${location.label}`}
                      className="h-12 w-auto object-contain max-w-[200px]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Logo atual</p>
                      <p className="text-xs text-muted-foreground truncate">{logoUrl}</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveLogo(location.key)}
                      disabled={isRemoving}
                    >
                      {isRemoving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}

                {!logoUrl && (
                  <div className="p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center">
                    <p className="text-muted-foreground text-sm">Nenhuma logo configurada</p>
                    <p className="text-xs text-muted-foreground/70">O sistema usará a logo padrão</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => document.getElementById(inputId)?.click()}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {logoUrl ? "Trocar logo" : "Enviar logo"}
                      </>
                    )}
                  </Button>
                  <input
                    id={inputId}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, location.key)}
                    className="hidden"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
