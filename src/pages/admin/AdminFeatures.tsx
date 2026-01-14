import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, Pencil, Trash2, Package, FileText, LayoutGrid, Truck, 
  Building, Globe, Code, MessageCircle, DollarSign, Loader2,
  Link as LinkIcon, Gift, Search, X, Crown
} from 'lucide-react';

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

interface FeaturePricing {
  id: string;
  feature_id: string;
  price_type: string;
  price: number;
  is_active: boolean;
}

interface Plan {
  id: string;
  key: string;
  name: string;
}

interface PlanFeature {
  id: string;
  plan_id: string;
  feature_id: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface CompanyFeature {
  id: string;
  company_id: string;
  feature_id: string;
  price_type: string;
  price_paid: number;
  purchased_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

const ICON_OPTIONS = [
  { value: 'FileText', label: 'Documento', icon: FileText },
  { value: 'LayoutGrid', label: 'Grade', icon: LayoutGrid },
  { value: 'Truck', label: 'Entrega', icon: Truck },
  { value: 'Package', label: 'Pacote', icon: Package },
  { value: 'Building', label: 'Prédio', icon: Building },
  { value: 'Globe', label: 'Globo', icon: Globe },
  { value: 'Code', label: 'Código', icon: Code },
  { value: 'MessageCircle', label: 'Mensagem', icon: MessageCircle },
];

const CATEGORY_OPTIONS = [
  { value: 'Principal', label: 'Principal' },
  { value: 'Minha Loja', label: 'Minha Loja' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Operações', label: 'Operações' },
  { value: 'Configurações', label: 'Configurações' },
  { value: 'Cardápio', label: 'Cardápio' },
];

function getIconComponent(iconName: string | null) {
  const iconOption = ICON_OPTIONS.find(opt => opt.value === iconName);
  if (iconOption) {
    const Icon = iconOption.icon;
    return <Icon className="h-5 w-5" />;
  }
  return <Package className="h-5 w-5" />;
}

export default function AdminFeatures() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [pricing, setPricing] = useState<FeaturePricing[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planFeatures, setPlanFeatures] = useState<PlanFeature[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyFeatures, setCompanyFeatures] = useState<CompanyFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingFeatureId, setTogglingFeatureId] = useState<string | null>(null);
  const [featureSearch, setFeatureSearch] = useState('');
  
  // Feature dialog state
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [featureForm, setFeatureForm] = useState({
    key: '',
    name: '',
    description: '',
    icon: 'Package',
    category: 'general',
    is_active: true,
  });

  // Pricing dialog state
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [selectedFeatureForPricing, setSelectedFeatureForPricing] = useState<Feature | null>(null);
  const [pricingForm, setPricingForm] = useState({
    price_type: 'monthly' as string,
    price: 0,
  });

  // Grant feature to company state
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [grantForm, setGrantForm] = useState({
    company_id: '',
    feature_id: '',
    price_type: 'one_time' as string,
    price_paid: 0,
    expires_at: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [featuresRes, pricingRes, plansRes, planFeaturesRes, companiesRes, companyFeaturesRes] = await Promise.all([
        supabase.from('system_features').select('*').order('category', { ascending: true }),
        supabase.from('feature_pricing').select('*'),
        supabase.from('subscription_plans').select('id, key, name').order('price', { ascending: true }),
        supabase.from('plan_features').select('*'),
        supabase.from('companies').select('id, name, slug').order('name', { ascending: true }),
        supabase.from('company_features').select('*'),
      ]);

      setFeatures(featuresRes.data || []);
      setPricing(pricingRes.data || []);
      setPlans(plansRes.data || []);
      setPlanFeatures(planFeaturesRes.data || []);
      setCompanies(companiesRes.data || []);
      setCompanyFeatures(companyFeaturesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveFeature() {
    if (!featureForm.key || !featureForm.name) {
      toast.error('Preencha a chave e o nome');
      return;
    }

    setSaving(true);
    try {
      if (editingFeature) {
        const { error } = await supabase
          .from('system_features')
          .update({
            key: featureForm.key,
            name: featureForm.name,
            description: featureForm.description || null,
            icon: featureForm.icon,
            category: featureForm.category,
            is_active: featureForm.is_active,
          })
          .eq('id', editingFeature.id);

        if (error) throw error;
        toast.success('Funcionalidade atualizada');
      } else {
        const { error } = await supabase
          .from('system_features')
          .insert({
            key: featureForm.key,
            name: featureForm.name,
            description: featureForm.description || null,
            icon: featureForm.icon,
            category: featureForm.category,
            is_active: featureForm.is_active,
          });

        if (error) throw error;
        toast.success('Funcionalidade criada');
      }

      setFeatureDialogOpen(false);
      resetFeatureForm();
      loadData();
      window.dispatchEvent(new Event('feature-access-refresh'));
    } catch (error: any) {
      console.error('Error saving feature:', error);
      toast.error(error.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFeature(feature: Feature) {
    if (!confirm(`Excluir funcionalidade "${feature.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('system_features')
        .delete()
        .eq('id', feature.id);

      if (error) throw error;
      toast.success('Funcionalidade excluída');
      loadData();
      window.dispatchEvent(new Event('feature-access-refresh'));
    } catch (error: any) {
      console.error('Error deleting feature:', error);
      toast.error(error.message || 'Erro ao excluir');
    }
  }

  async function toggleFeatureActive(feature: Feature, nextActive: boolean) {
    try {
      setTogglingFeatureId(feature.id);

      const { error } = await supabase
        .from('system_features')
        .update({ is_active: nextActive })
        .eq('id', feature.id);

      if (error) throw error;

      toast.success(nextActive ? 'Funcionalidade ativada' : 'Funcionalidade desativada');
      loadData();
      window.dispatchEvent(new Event('feature-access-refresh'));
    } catch (error: any) {
      console.error('Error toggling feature active:', error);
      toast.error(error.message || 'Erro ao atualizar');
    } finally {
      setTogglingFeatureId(null);
    }
  }

  async function handleSavePricing() {
    if (!selectedFeatureForPricing) return;

    setSaving(true);
    try {
      // Regra: cada feature só pode ter UM tipo de preço (único OU mensal)
      // Então deletamos todos os preços existentes antes de inserir o novo
      const existingPrices = pricing.filter(p => p.feature_id === selectedFeatureForPricing.id);
      
      if (existingPrices.length > 0) {
        // Deletar todos os preços existentes desta feature
        const { error: deleteError } = await supabase
          .from('feature_pricing')
          .delete()
          .eq('feature_id', selectedFeatureForPricing.id);

        if (deleteError) throw deleteError;
      }

      // Inserir o novo preço
      const { error } = await supabase
        .from('feature_pricing')
        .insert({
          feature_id: selectedFeatureForPricing.id,
          price_type: pricingForm.price_type,
          price: pricingForm.price,
          is_active: true,
        });

      if (error) throw error;

      toast.success(`Preço ${pricingForm.price_type === 'one_time' ? 'único' : 'mensal'} definido`);
      setPricingDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving pricing:', error);
      toast.error(error.message || 'Erro ao salvar preço');
    } finally {
      setSaving(false);
    }
  }

  async function togglePlanFeature(planId: string, featureId: string) {
    const existing = planFeatures.find(
      pf => pf.plan_id === planId && pf.feature_id === featureId
    );

    try {
      if (existing) {
        const { error } = await supabase
          .from('plan_features')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plan_features')
          .insert({ plan_id: planId, feature_id: featureId });

        if (error) throw error;
      }

      loadData();
    } catch (error: any) {
      console.error('Error toggling plan feature:', error);
      toast.error(error.message || 'Erro ao atualizar');
    }
  }

  async function toggleAllFeaturesForPlan(planId: string, selectAll: boolean) {
    try {
      if (selectAll) {
        // Adicionar todas as features que ainda não estão vinculadas
        const existingFeatureIds = planFeatures
          .filter(pf => pf.plan_id === planId)
          .map(pf => pf.feature_id);
        
        const featuresToAdd = features
          .filter(f => !existingFeatureIds.includes(f.id))
          .map(f => ({ plan_id: planId, feature_id: f.id }));

        if (featuresToAdd.length > 0) {
          const { error } = await supabase
            .from('plan_features')
            .insert(featuresToAdd);
          if (error) throw error;
        }
        toast.success('Todas as funcionalidades foram marcadas');
      } else {
        // Remover todas as features do plano
        const { error } = await supabase
          .from('plan_features')
          .delete()
          .eq('plan_id', planId);
        if (error) throw error;
        toast.success('Todas as funcionalidades foram desmarcadas');
      }

      loadData();
    } catch (error: any) {
      console.error('Error toggling all features:', error);
      toast.error(error.message || 'Erro ao atualizar');
    }
  }

  function resetFeatureForm() {
    setEditingFeature(null);
    setFeatureForm({
      key: '',
      name: '',
      description: '',
      icon: 'Package',
      category: 'general',
      is_active: true,
    });
  }

  function openEditFeature(feature: Feature) {
    setEditingFeature(feature);
    setFeatureForm({
      key: feature.key,
      name: feature.name,
      description: feature.description || '',
      icon: feature.icon || 'Package',
      category: feature.category || 'general',
      is_active: feature.is_active,
    });
    setFeatureDialogOpen(true);
  }

  function openPricingDialog(feature: Feature) {
    setSelectedFeatureForPricing(feature);
    const existingPricing = pricing.find(p => p.feature_id === feature.id);
    setPricingForm({
      price_type: existingPricing?.price_type || 'monthly',
      price: existingPricing?.price || 0,
    });
    setPricingDialogOpen(true);
  }

  function getFeaturePricing(featureId: string) {
    return pricing.filter(p => p.feature_id === featureId);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  // Filter companies based on search
  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
    c.slug.toLowerCase().includes(companySearch.toLowerCase())
  );

  async function handleGrantFeature() {
    if (!grantForm.company_id || !grantForm.feature_id) {
      toast.error('Selecione a empresa e a funcionalidade');
      return;
    }

    setSaving(true);
    try {
      const insertData: any = {
        company_id: grantForm.company_id,
        feature_id: grantForm.feature_id,
        price_type: grantForm.price_type,
        price_paid: grantForm.price_paid,
        is_active: true,
        purchased_at: new Date().toISOString(),
      };

      if (grantForm.price_type === 'monthly' && grantForm.expires_at) {
        insertData.expires_at = grantForm.expires_at;
      }

      const { error } = await supabase
        .from('company_features')
        .insert(insertData);

      if (error) throw error;

      toast.success('Funcionalidade concedida com sucesso');
      setGrantDialogOpen(false);
      setGrantForm({
        company_id: '',
        feature_id: '',
        price_type: 'one_time',
        price_paid: 0,
        expires_at: '',
      });
      setCompanySearch('');
      loadData();
    } catch (error: any) {
      console.error('Error granting feature:', error);
      toast.error(error.message || 'Erro ao conceder funcionalidade');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeCompanyFeature(companyFeatureId: string) {
    if (!confirm('Remover esta funcionalidade da empresa?')) return;

    try {
      const { error } = await supabase
        .from('company_features')
        .delete()
        .eq('id', companyFeatureId);

      if (error) throw error;
      toast.success('Funcionalidade removida');
      loadData();
    } catch (error: any) {
      console.error('Error revoking feature:', error);
      toast.error(error.message || 'Erro ao remover');
    }
  }

  async function toggleCompanyFeatureActive(cf: CompanyFeature) {
    try {
      const { error } = await supabase
        .from('company_features')
        .update({ is_active: !cf.is_active })
        .eq('id', cf.id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      console.error('Error toggling feature:', error);
      toast.error(error.message || 'Erro ao atualizar');
    }
  }

  function getCompanyName(companyId: string) {
    return companies.find(c => c.id === companyId)?.name || 'Desconhecida';
  }

  function getFeatureName(featureId: string) {
    return features.find(f => f.id === featureId)?.name || 'Desconhecida';
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Filtrar features por pesquisa
  const filteredFeatures = features.filter(f =>
    f.name.toLowerCase().includes(featureSearch.toLowerCase()) ||
    f.key.toLowerCase().includes(featureSearch.toLowerCase()) ||
    (f.description && f.description.toLowerCase().includes(featureSearch.toLowerCase()))
  );

  // Agrupar features por categoria
  const groupedFeatures = filteredFeatures.reduce((acc, feature) => {
    const category = feature.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Funcionalidades do Sistema</h1>
            <p className="text-muted-foreground">
              Gerencie funcionalidades que podem ser vendidas avulsas ou incluídas nos planos
            </p>
          </div>
          <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetFeatureForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Funcionalidade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingFeature ? 'Editar Funcionalidade' : 'Nova Funcionalidade'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Chave (única)</Label>
                    <Input
                      value={featureForm.key}
                      onChange={e => setFeatureForm(f => ({ ...f, key: e.target.value }))}
                      placeholder="ex: nfe, tables"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={featureForm.name}
                      onChange={e => setFeatureForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="ex: NF-e / NFC-e"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={featureForm.description}
                    onChange={e => setFeatureForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descrição da funcionalidade..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <Select
                      value={featureForm.icon}
                      onValueChange={v => setFeatureForm(f => ({ ...f, icon: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.icon className="h-4 w-4" />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={featureForm.category}
                      onValueChange={v => setFeatureForm(f => ({ ...f, category: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={featureForm.is_active}
                    onCheckedChange={v => setFeatureForm(f => ({ ...f, is_active: v }))}
                  />
                  <Label>Funcionalidade ativa</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFeatureDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveFeature} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="features">
          <TabsList>
            <TabsTrigger value="features">Funcionalidades</TabsTrigger>
            <TabsTrigger value="plans">Vincular aos Planos</TabsTrigger>
            <TabsTrigger value="companies">Conceder a Empresas</TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-6">
            {/* Campo de pesquisa */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar funcionalidades..."
                value={featureSearch}
                onChange={e => setFeatureSearch(e.target.value)}
                className="pl-9 pr-9"
              />
              {featureSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setFeatureSearch('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {Object.entries(groupedFeatures).length === 0 && featureSearch && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma funcionalidade encontrada para "{featureSearch}"
              </div>
            )}

            {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 capitalize">
                  {CATEGORY_OPTIONS.find(c => c.value === category)?.label || category}
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryFeatures.map(feature => {
                    const featurePrices = getFeaturePricing(feature.id);
                    return (
                      <Card key={feature.id} className={!feature.is_active ? 'opacity-50' : ''}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                              {getIconComponent(feature.icon)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-base truncate">{feature.name}</CardTitle>
                                {featurePrices.length > 0 && (
                                  <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 gap-1 shrink-0 text-xs">
                                    <Crown className="h-3 w-3" />
                                    Premium
                                  </Badge>
                                )}
                              </div>
                              <code className="text-xs text-muted-foreground">{feature.key}</code>
                            </div>
                          </div>
                          
                          {/* Ações em linha separada */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={feature.is_active}
                                onCheckedChange={(v) => toggleFeatureActive(feature, v)}
                                disabled={togglingFeatureId === feature.id}
                              />
                              <span className="text-xs text-muted-foreground">
                                {feature.is_active ? 'Ativa' : 'Inativa'}
                              </span>
                            </div>

                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openPricingDialog(feature)}
                                title="Definir preço"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditFeature(feature)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteFeature(feature)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {feature.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {feature.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {featurePrices.length > 0 ? (
                              featurePrices.map(price => (
                                <Badge key={price.id} variant="secondary">
                                  {price.price_type === 'monthly' ? 'Mensal' : 'Único'}:{' '}
                                  {formatCurrency(price.price)}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline">Sem preço definido</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="plans">
            <Card>
              <CardHeader>
                <CardTitle>Vincular Funcionalidades aos Planos</CardTitle>
                <CardDescription>
                  Marque quais funcionalidades estão incluídas em cada plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Funcionalidade</th>
                        {plans.map(plan => {
                          const linkedCount = planFeatures.filter(pf => pf.plan_id === plan.id).length;
                          const allLinked = linkedCount === features.length;
                          return (
                            <th key={plan.id} className="text-center p-3">
                              <div className="flex flex-col items-center gap-1">
                                <span>{plan.name}</span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    onClick={() => toggleAllFeaturesForPlan(plan.id, true)}
                                    disabled={allLinked}
                                  >
                                    Todos
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    onClick={() => toggleAllFeaturesForPlan(plan.id, false)}
                                    disabled={linkedCount === 0}
                                  >
                                    Nenhum
                                  </Button>
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {features.map(feature => (
                        <tr key={feature.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {getIconComponent(feature.icon)}
                              <span>{feature.name}</span>
                            </div>
                          </td>
                          {plans.map(plan => {
                            const isLinked = planFeatures.some(
                              pf => pf.plan_id === plan.id && pf.feature_id === feature.id
                            );
                            return (
                              <td key={plan.id} className="text-center p-3">
                                <Switch
                                  checked={isLinked}
                                  onCheckedChange={() => togglePlanFeature(plan.id, feature.id)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Conceder Funcionalidades a Empresas</CardTitle>
                    <CardDescription>
                      Atribua funcionalidades específicas para empresas individuais
                    </CardDescription>
                  </div>
                  <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Gift className="h-4 w-4 mr-2" />
                        Conceder Funcionalidade
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Conceder Funcionalidade</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Buscar Empresa</Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Digite o nome da empresa..."
                              value={companySearch}
                              onChange={e => setCompanySearch(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                          {companySearch && (
                            <div className="border rounded-md max-h-40 overflow-y-auto">
                              {filteredCompanies.length > 0 ? (
                                filteredCompanies.slice(0, 10).map(company => (
                                  <button
                                    key={company.id}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                                      grantForm.company_id === company.id ? 'bg-primary/10' : ''
                                    }`}
                                    onClick={() => {
                                      setGrantForm(f => ({ ...f, company_id: company.id }));
                                      setCompanySearch(company.name);
                                    }}
                                  >
                                    <div className="font-medium">{company.name}</div>
                                    <div className="text-xs text-muted-foreground">{company.slug}</div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-muted-foreground text-sm">
                                  Nenhuma empresa encontrada
                                </div>
                              )}
                            </div>
                          )}
                          {grantForm.company_id && (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                              <Building className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {getCompanyName(grantForm.company_id)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-auto"
                                onClick={() => {
                                  setGrantForm(f => ({ ...f, company_id: '' }));
                                  setCompanySearch('');
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Funcionalidade</Label>
                          <Select
                            value={grantForm.feature_id}
                            onValueChange={v => setGrantForm(f => ({ ...f, feature_id: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma funcionalidade" />
                            </SelectTrigger>
                            <SelectContent>
                              {features.filter(f => f.is_active).map(feature => (
                                <SelectItem key={feature.id} value={feature.id}>
                                  <div className="flex items-center gap-2">
                                    {getIconComponent(feature.icon)}
                                    {feature.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                              value={grantForm.price_type}
                              onValueChange={v => setGrantForm(f => ({ ...f, price_type: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="one_time">Permanente</SelectItem>
                                <SelectItem value="monthly">Mensal (com expiração)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Valor Pago (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={grantForm.price_paid}
                              onChange={e => setGrantForm(f => ({ ...f, price_paid: parseFloat(e.target.value) || 0 }))}
                              placeholder="0 = Cortesia"
                            />
                          </div>
                        </div>

                        {grantForm.price_type === 'monthly' && (
                          <div className="space-y-2">
                            <Label>Data de Expiração</Label>
                            <Input
                              type="date"
                              value={grantForm.expires_at}
                              onChange={e => setGrantForm(f => ({ ...f, expires_at: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleGrantFeature} disabled={saving}>
                          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Conceder
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {companyFeatures.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma funcionalidade concedida individualmente ainda.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Empresa</th>
                          <th className="text-left p-3">Funcionalidade</th>
                          <th className="text-left p-3">Tipo</th>
                          <th className="text-left p-3">Valor Pago</th>
                          <th className="text-left p-3">Expira em</th>
                          <th className="text-center p-3">Ativo</th>
                          <th className="text-center p-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyFeatures.map(cf => (
                          <tr key={cf.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">
                              <div className="font-medium">{getCompanyName(cf.company_id)}</div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {getIconComponent(features.find(f => f.id === cf.feature_id)?.icon || null)}
                                {getFeatureName(cf.feature_id)}
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant={cf.price_type === 'one_time' ? 'default' : 'secondary'}>
                                {cf.price_type === 'one_time' ? 'Permanente' : 'Mensal'}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {cf.price_paid === 0 ? (
                                <Badge variant="outline">Cortesia</Badge>
                              ) : (
                                formatCurrency(cf.price_paid)
                              )}
                            </td>
                            <td className="p-3">
                              {cf.expires_at ? (
                                <span className={new Date(cf.expires_at) < new Date() ? 'text-destructive' : ''}>
                                  {new Date(cf.expires_at).toLocaleDateString('pt-BR')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="text-center p-3">
                              <Switch
                                checked={cf.is_active}
                                onCheckedChange={() => toggleCompanyFeatureActive(cf)}
                              />
                            </td>
                            <td className="text-center p-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRevokeCompanyFeature(cf.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Pricing Dialog */}
        <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Definir Preço: {selectedFeatureForPricing?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Cobrança</Label>
                <Select
                  value={pricingForm.price_type}
                  onValueChange={v => setPricingForm(f => ({ ...f, price_type: v as 'one_time' | 'monthly' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal (recorrente)</SelectItem>
                    <SelectItem value="one_time">Pagamento Único</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricingForm.price}
                  onChange={e => setPricingForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPricingDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSavePricing} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Preço
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
