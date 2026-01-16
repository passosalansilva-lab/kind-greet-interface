import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Percent, PlusCircle } from "lucide-react";

// Tipos simplificados para este relatório
interface Company {
  id: string;
  name: string;
  subscription_plan: string | null;
  status: "pending" | "approved" | "suspended";
}

interface SubscriptionPlan {
  id: string;
  key: string;
  name: string;
  price: number;
  is_active: boolean | null;
}

interface Referral {
  id: string;
  referrer_company_id: string;
  referred_company_id: string;
  commission_percentage: number;
  created_at: string;
  valid_until: string | null;
  notes: string | null;
}

interface ReferralWithComputed extends Referral {
  referrerCompany?: Company;
  referredCompany?: Company;
  plan?: SubscriptionPlan | null;
  estimatedCommission: number;
}

const DEFAULT_COMMISSION_PERCENTAGE = 10; // 10% por padrão

const AdminReferrals = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  const [referrerCompanyId, setReferrerCompanyId] = useState<string>("");
  const [referredCompanyId, setReferredCompanyId] = useState<string>("");
  const [commissionPercentage, setCommissionPercentage] = useState<string>(
    String(DEFAULT_COMMISSION_PERCENTAGE),
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [{ data: companiesData, error: companiesError }, { data: plansData, error: plansError }, {
          data: referralsData,
          error: referralsError,
        }] = await Promise.all([
          supabase
            .from("companies")
            .select("id, name, subscription_plan, status")
            .order("name", { ascending: true }),
          supabase.from("subscription_plans").select("id, key, name, price, is_active"),
          supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        ]);

        if (companiesError) throw companiesError;
        if (plansError) throw plansError;
        if (referralsError) throw referralsError;

        setCompanies(companiesData || []);
        setPlans(plansData || []);
        setReferrals(referralsData || []);
      } catch (error: any) {
        console.error("Erro ao carregar dados de indicações:", error);
        toast({
          title: "Erro ao carregar indicações",
          description: error.message ?? "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [toast]);

  const referralsWithComputed: ReferralWithComputed[] = useMemo(() => {
    return referrals.map((referral) => {
      const referrerCompany = companies.find((c) => c.id === referral.referrer_company_id);
      const referredCompany = companies.find((c) => c.id === referral.referred_company_id);
      const plan = plans.find(
        (p) => p.key === (referredCompany?.subscription_plan ?? undefined),
      );
      const basePrice = Number(plan?.price ?? 0);
      const percentage = Number(referral.commission_percentage ?? 0);
      const estimatedCommission = (basePrice * percentage) || 0;

      return {
        ...referral,
        referrerCompany,
        referredCompany,
        plan: plan ?? null,
        estimatedCommission,
      };
    });
  }, [referrals, companies, plans]);

  const totalsByReferrer = useMemo(() => {
    const map = new Map<string, { company: Company; total: number }>();

    for (const item of referralsWithComputed) {
      if (!item.referrerCompany) continue;
      const key = item.referrerCompany.id;
      const current = map.get(key) ?? { company: item.referrerCompany, total: 0 };
      current.total += item.estimatedCommission;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [referralsWithComputed]);

  const handleCreateReferral = async () => {
    if (!referrerCompanyId || !referredCompanyId) {
      toast({
        title: "Selecione as empresas",
        description: "Escolha a empresa indicadora e a empresa indicada.",
        variant: "destructive",
      });
      return;
    }

    if (referrerCompanyId === referredCompanyId) {
      toast({
        title: "Indicação inválida",
        description: "Uma empresa não pode indicar a si mesma.",
        variant: "destructive",
      });
      return;
    }

    const pct = Number(commissionPercentage.replace(",", "."));
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({
        title: "Percentual inválido",
        description: "Informe um percentual entre 1% e 100%.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from("referrals")
        .insert({
          referrer_company_id: referrerCompanyId,
          referred_company_id: referredCompanyId,
          commission_percentage: pct / 100,
        })
        .select("*")
        .single();

      if (error) throw error;

      setReferrals((prev) => [data as Referral, ...prev]);
      setReferrerCompanyId("");
      setReferredCompanyId("");
      setCommissionPercentage(String(DEFAULT_COMMISSION_PERCENTAGE));

      toast({
        title: "Indicação criada",
        description: "A relação de indicação foi cadastrada com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao criar indicação:", error);
      let description = error.message ?? "Tente novamente em alguns instantes.";
      if (String(error.message).includes("referrals_unique_pair")) {
        description = "Essa relação de indicação já existe.";
      }
      toast({
        title: "Erro ao criar indicação",
        description,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = "Programa de Indicações";

  return (
    <DashboardLayout>
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Cadastre relações de indicação entre empresas e visualize o extrato estimado de comissões
          mensais, baseado no valor atual da assinatura de cada plano.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1.2fr,0.8fr] lg:grid-cols-[1.4fr,0.6fr]">
        {/* Cadastro de indicação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <PlusCircle className="h-5 w-5 text-primary" />
              Nova indicação entre empresas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Empresa indicadora</label>
                <Select value={referrerCompanyId} onValueChange={setReferrerCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa que indicou" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Empresa indicada</label>
                <Select value={referredCompanyId} onValueChange={setReferredCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa indicada" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr,auto] items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  Percentual sobre a assinatura mensal
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={commissionPercentage}
                    onChange={(e) => setCommissionPercentage(e.target.value)}
                    placeholder="Ex: 10"
                    className="pr-10"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exemplo: 10% de comissão recorrente enquanto a empresa indicada mantiver a assinatura.
                </p>
              </div>

              <Button onClick={handleCreateReferral} disabled={saving} className="w-full md:w-auto">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar indicação
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resumo por empresa indicadora */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Resumo por empresa indicadora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Valores estimados com base no plano atual de cada empresa indicada. Use como base
              para gerar o relatório de pagamento mensal.
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : totalsByReferrer.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma indicação cadastrada até o momento.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {totalsByReferrer.map(({ company, total }) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2"
                  >
                    <span className="font-medium truncate mr-3">{company.name}</span>
                    <span className="tabular-nums font-semibold">
                      R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela detalhada de indicações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Extrato de indicações e comissões estimadas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : referralsWithComputed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma indicação cadastrada ainda. Use o formulário acima para registrar sua
              primeira indicação.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa indicadora</TableHead>
                    <TableHead>Empresa indicada</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Assinatura</TableHead>
                    <TableHead className="text-right">% Comissão</TableHead>
                    <TableHead className="text-right">Comissão estimada/mês</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralsWithComputed.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.referrerCompany?.name ?? "-"}
                      </TableCell>
                      <TableCell>{item.referredCompany?.name ?? "-"}</TableCell>
                      <TableCell>{item.plan?.name ?? "Plano atual"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.plan
                          ? `R$ ${Number(item.plan.price ?? 0).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(Number(item.commission_percentage ?? 0) * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                        %
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        R$
                        {" "}
                        {item.estimatedCommission.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
};

export default AdminReferrals;
