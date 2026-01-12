import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Database, 
  Server, 
  Shield, 
  Code, 
  Layers, 
  FileCode, 
  GitBranch,
  Webhook,
  Lock,
  Users,
  Package,
  FolderTree
} from 'lucide-react';

const DevDocs = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentação Técnica</h1>
          <p className="text-muted-foreground">
            Documentação completa da arquitetura e implementação do sistema CardápioOn
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-2">
            <TabsTrigger value="overview" className="gap-2">
              <Layers className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="stack" className="gap-2">
              <Package className="h-4 w-4" />
              Tech Stack
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2">
              <Database className="h-4 w-4" />
              Banco de Dados
            </TabsTrigger>
            <TabsTrigger value="auth" className="gap-2">
              <Shield className="h-4 w-4" />
              Autenticação
            </TabsTrigger>
            <TabsTrigger value="functions" className="gap-2">
              <Server className="h-4 w-4" />
              Edge Functions
            </TabsTrigger>
            <TabsTrigger value="structure" className="gap-2">
              <FolderTree className="h-4 w-4" />
              Estrutura
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Arquitetura do Sistema
                </CardTitle>
                <CardDescription>
                  Visão geral da arquitetura e fluxo de dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Frontend</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <ul className="space-y-1">
                        <li>• React 18 + TypeScript</li>
                        <li>• Vite como bundler</li>
                        <li>• Tailwind CSS + shadcn/ui</li>
                        <li>• React Router v6</li>
                        <li>• TanStack Query v5</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Backend</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <ul className="space-y-1">
                        <li>• Supabase (PostgreSQL)</li>
                        <li>• Edge Functions (Deno)</li>
                        <li>• Row Level Security (RLS)</li>
                        <li>• Realtime subscriptions</li>
                        <li>• Storage para arquivos</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Integrações</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <ul className="space-y-1">
                        <li>• MercadoPago (pagamentos)</li>
                        <li>• PicPay (pagamentos)</li>
                        <li>• Resend (e-mails)</li>
                        <li>• Mapbox (mapas)</li>
                        <li>• Web Push (notificações)</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4">
                  <h3 className="font-semibold mb-3">Fluxo de Dados Principal</h3>
                  <div className="text-sm space-y-2 font-mono bg-background p-4 rounded-md">
                    <p>1. Cliente acessa cardápio público → /menu/:slug</p>
                    <p>2. Busca dados da empresa via Supabase (RLS: público)</p>
                    <p>3. Cliente monta pedido → useCart hook gerencia estado</p>
                    <p>4. Checkout → Edge Function processa pagamento</p>
                    <p>5. Pedido salvo → Realtime notifica lojista</p>
                    <p>6. Lojista gerencia → Dashboard com atualizações em tempo real</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stack">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Tecnologias Utilizadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="frontend">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Frontend
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">React</span>
                            <Badge variant="secondary">^18.3.1</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">TypeScript</span>
                            <Badge variant="secondary">^5.6.2</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">Vite</span>
                            <Badge variant="secondary">^5.4.11</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">Tailwind CSS</span>
                            <Badge variant="secondary">^3.4.17</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">shadcn/ui</span>
                            <Badge variant="secondary">Components</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">React Router</span>
                            <Badge variant="secondary">^6.30.1</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">TanStack Query</span>
                            <Badge variant="secondary">^5.83.0</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">Framer Motion</span>
                            <Badge variant="secondary">^12.23.26</Badge>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="backend">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Backend & Database
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">Supabase</span>
                            <Badge variant="secondary">^2.89.0</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">PostgreSQL</span>
                            <Badge variant="secondary">15+</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted">
                            <span className="font-medium">Deno</span>
                            <Badge variant="secondary">Edge Functions</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>O backend utiliza Supabase como BaaS (Backend as a Service) com:</p>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>PostgreSQL para persistência de dados</li>
                            <li>Row Level Security (RLS) para controle de acesso</li>
                            <li>Edge Functions para lógica serverless</li>
                            <li>Realtime para atualizações em tempo real</li>
                            <li>Storage para upload de arquivos</li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="libs">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <FileCode className="h-4 w-4" />
                        Bibliotecas Principais
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <div>
                            <span className="font-medium">@dnd-kit</span>
                            <p className="text-xs text-muted-foreground">Drag and drop</p>
                          </div>
                          <Badge variant="outline">UI</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <div>
                            <span className="font-medium">react-hook-form + zod</span>
                            <p className="text-xs text-muted-foreground">Formulários e validação</p>
                          </div>
                          <Badge variant="outline">Forms</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <div>
                            <span className="font-medium">recharts</span>
                            <p className="text-xs text-muted-foreground">Gráficos e dashboards</p>
                          </div>
                          <Badge variant="outline">Charts</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <div>
                            <span className="font-medium">mapbox-gl</span>
                            <p className="text-xs text-muted-foreground">Mapas interativos</p>
                          </div>
                          <Badge variant="outline">Maps</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <div>
                            <span className="font-medium">jspdf + xlsx</span>
                            <p className="text-xs text-muted-foreground">Exportação de relatórios</p>
                          </div>
                          <Badge variant="outline">Export</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <div>
                            <span className="font-medium">qrcode</span>
                            <p className="text-xs text-muted-foreground">Geração de QR codes</p>
                          </div>
                          <Badge variant="outline">Utils</Badge>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Estrutura do Banco de Dados
                </CardTitle>
                <CardDescription>
                  Principais tabelas e relacionamentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="core">
                    <AccordionTrigger>Tabelas Core</AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4 pr-4">
                          <TableDoc
                            name="companies"
                            description="Empresas/lojas cadastradas no sistema"
                            columns={[
                              { name: 'id', type: 'uuid', description: 'PK' },
                              { name: 'owner_id', type: 'uuid', description: 'FK → auth.users' },
                              { name: 'name', type: 'text', description: 'Nome da empresa' },
                              { name: 'slug', type: 'text', description: 'URL amigável (único)' },
                              { name: 'status', type: 'text', description: 'pending, approved, suspended' },
                              { name: 'settings', type: 'jsonb', description: 'Configurações gerais' },
                            ]}
                          />

                          <TableDoc
                            name="products"
                            description="Produtos do cardápio"
                            columns={[
                              { name: 'id', type: 'uuid', description: 'PK' },
                              { name: 'company_id', type: 'uuid', description: 'FK → companies' },
                              { name: 'category_id', type: 'uuid', description: 'FK → categories' },
                              { name: 'name', type: 'text', description: 'Nome do produto' },
                              { name: 'price', type: 'numeric', description: 'Preço' },
                              { name: 'options', type: 'jsonb', description: 'Opções/adicionais' },
                            ]}
                          />

                          <TableDoc
                            name="orders"
                            description="Pedidos realizados"
                            columns={[
                              { name: 'id', type: 'uuid', description: 'PK' },
                              { name: 'company_id', type: 'uuid', description: 'FK → companies' },
                              { name: 'customer_id', type: 'uuid', description: 'FK → customers' },
                              { name: 'status', type: 'text', description: 'pending, confirmed, preparing, ready, delivered, cancelled' },
                              { name: 'items', type: 'jsonb', description: 'Itens do pedido' },
                              { name: 'total', type: 'numeric', description: 'Valor total' },
                              { name: 'payment_method', type: 'text', description: 'Forma de pagamento' },
                            ]}
                          />

                          <TableDoc
                            name="customers"
                            description="Clientes que fizeram pedidos"
                            columns={[
                              { name: 'id', type: 'uuid', description: 'PK' },
                              { name: 'company_id', type: 'uuid', description: 'FK → companies' },
                              { name: 'name', type: 'text', description: 'Nome' },
                              { name: 'phone', type: 'text', description: 'Telefone (WhatsApp)' },
                              { name: 'email', type: 'text', description: 'E-mail (opcional)' },
                            ]}
                          />
                        </div>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="auth">
                    <AccordionTrigger>Autenticação e Roles</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <TableDoc
                          name="user_roles"
                          description="Papéis de usuário (RBAC)"
                          columns={[
                            { name: 'id', type: 'uuid', description: 'PK' },
                            { name: 'user_id', type: 'uuid', description: 'FK → auth.users' },
                            { name: 'role', type: 'app_role', description: 'super_admin, store_owner, store_staff, delivery_driver' },
                          ]}
                        />

                        <TableDoc
                          name="company_staff"
                          description="Funcionários vinculados a empresas"
                          columns={[
                            { name: 'id', type: 'uuid', description: 'PK' },
                            { name: 'company_id', type: 'uuid', description: 'FK → companies' },
                            { name: 'user_id', type: 'uuid', description: 'FK → auth.users' },
                            { name: 'permissions', type: 'jsonb', description: 'Permissões específicas' },
                          ]}
                        />

                        <div className="rounded-lg border p-4 bg-amber-500/10 border-amber-500/20">
                          <h4 className="font-semibold text-amber-600 mb-2">⚠️ Importante: Segurança de Roles</h4>
                          <p className="text-sm text-muted-foreground">
                            Roles são verificados via função <code className="bg-muted px-1 rounded">public.has_role()</code> 
                            com SECURITY DEFINER para evitar recursão em políticas RLS.
                            Nunca armazene roles na tabela profiles ou auth.users.
                          </p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="features">
                    <AccordionTrigger>Features e Assinaturas</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <TableDoc
                          name="subscription_plans"
                          description="Planos de assinatura disponíveis"
                          columns={[
                            { name: 'id', type: 'uuid', description: 'PK' },
                            { name: 'name', type: 'text', description: 'Nome do plano' },
                            { name: 'price', type: 'numeric', description: 'Preço mensal' },
                            { name: 'features', type: 'jsonb', description: 'Features inclusas' },
                          ]}
                        />

                        <TableDoc
                          name="company_subscriptions"
                          description="Assinaturas ativas das empresas"
                          columns={[
                            { name: 'id', type: 'uuid', description: 'PK' },
                            { name: 'company_id', type: 'uuid', description: 'FK → companies' },
                            { name: 'plan_id', type: 'uuid', description: 'FK → subscription_plans' },
                            { name: 'status', type: 'text', description: 'active, cancelled, expired' },
                            { name: 'expires_at', type: 'timestamp', description: 'Data de expiração' },
                          ]}
                        />

                        <TableDoc
                          name="purchasable_features"
                          description="Features avulsas para compra"
                          columns={[
                            { name: 'id', type: 'uuid', description: 'PK' },
                            { name: 'code', type: 'text', description: 'Código único da feature' },
                            { name: 'name', type: 'text', description: 'Nome da feature' },
                            { name: 'price', type: 'numeric', description: 'Preço' },
                          ]}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="operations">
                    <AccordionTrigger>Operações e Logística</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <TableDoc
                          name="delivery_drivers"
                          description="Entregadores cadastrados"
                          columns={[
                            { name: 'id', type: 'uuid', description: 'PK' },
                            { name: 'company_id', type: 'uuid', description: 'FK → companies' },
                            { name: 'name', type: 'text', description: 'Nome' },
                            { name: 'phone', type: 'text', description: 'Telefone' },
                            { name: 'status', type: 'text', description: 'available, busy, offline' },
                          ]}
                        />

                        <TableDoc
                          name="restaurant_tables"
                          description="Mesas do restaurante"
                          columns={[
                            { name: 'id', type: 'uuid', description: 'PK' },
                            { name: 'company_id', type: 'uuid', description: 'FK → companies' },
                            { name: 'number', type: 'integer', description: 'Número da mesa' },
                            { name: 'status', type: 'text', description: 'available, occupied' },
                          ]}
                        />

                        <TableDoc
                          name="inventory_items"
                          description="Itens de estoque"
                          columns={[
                            { name: 'id', type: 'uuid', description: 'PK' },
                            { name: 'company_id', type: 'uuid', description: 'FK → companies' },
                            { name: 'name', type: 'text', description: 'Nome do ingrediente' },
                            { name: 'quantity', type: 'numeric', description: 'Quantidade atual' },
                            { name: 'min_quantity', type: 'numeric', description: 'Estoque mínimo' },
                          ]}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auth">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Sistema de Autenticação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Roles Disponíveis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">super_admin</Badge>
                          <span className="text-sm text-muted-foreground">Acesso total ao sistema</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">store_owner</Badge>
                          <span className="text-sm text-muted-foreground">Dono de loja</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">store_staff</Badge>
                          <span className="text-sm text-muted-foreground">Funcionário de loja</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">delivery_driver</Badge>
                          <span className="text-sm text-muted-foreground">Entregador</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Fluxo de Auth
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p>1. Login via Supabase Auth (email/senha)</p>
                      <p>2. useAuth hook carrega sessão e roles</p>
                      <p>3. ProtectedRoute verifica autenticação</p>
                      <p>4. Componentes usam hasRole() para RBAC</p>
                      <p>5. RLS no banco valida via has_role()</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4">
                  <h3 className="font-semibold mb-3">Hook useAuth - Principais Exports</h3>
                  <pre className="text-sm bg-background p-4 rounded-md overflow-x-auto">
{`interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  staffCompany: StaffCompanyInfo | null;
  signIn: (email, password) => Promise<{ error }>;
  signUp: (email, password, fullName, phone) => Promise<{ error }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refreshRoles: () => Promise<void>;
}`}
                  </pre>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4">
                  <h3 className="font-semibold mb-3">Função has_role (PostgreSQL)</h3>
                  <pre className="text-sm bg-background p-4 rounded-md overflow-x-auto">
{`-- SECURITY DEFINER evita recursão em RLS
create or replace function public.has_role(
  _user_id uuid, 
  _role app_role
) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="functions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Edge Functions
                </CardTitle>
                <CardDescription>
                  Funções serverless para lógica de backend
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Accordion type="multiple" className="w-full pr-4">
                    <AccordionItem value="payments">
                      <AccordionTrigger>Pagamentos</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <FunctionDoc name="create-pix-payment" description="Gera QR code PIX via MercadoPago" />
                          <FunctionDoc name="check-pix-payment" description="Verifica status de pagamento PIX" />
                          <FunctionDoc name="create-card-payment" description="Processa pagamento com cartão" />
                          <FunctionDoc name="create-picpay-pix" description="Gera PIX via PicPay" />
                          <FunctionDoc name="mercadopago-webhook" description="Recebe webhooks do MercadoPago" />
                          <FunctionDoc name="picpay-webhook" description="Recebe webhooks do PicPay" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="subscriptions">
                      <AccordionTrigger>Assinaturas</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <FunctionDoc name="create-subscription" description="Cria nova assinatura" />
                          <FunctionDoc name="check-subscription" description="Verifica status da assinatura" />
                          <FunctionDoc name="create-mercadopago-subscription" description="Assinatura recorrente MP" />
                          <FunctionDoc name="check-subscription-expirations" description="CRON: verifica expirações" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="notifications">
                      <AccordionTrigger>Notificações</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <FunctionDoc name="send-push-notification" description="Envia push notification" />
                          <FunctionDoc name="send-order-confirmation" description="E-mail de confirmação de pedido" />
                          <FunctionDoc name="send-lottery-winner-email" description="E-mail para ganhador do sorteio" />
                          <FunctionDoc name="send-driver-welcome" description="E-mail de boas-vindas entregador" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="delivery">
                      <AccordionTrigger>Delivery</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <FunctionDoc name="assign-driver" description="Atribui entregador ao pedido" />
                          <FunctionDoc name="broadcast-order-offers" description="Oferece pedido aos entregadores" />
                          <FunctionDoc name="accept-order-offer" description="Entregador aceita oferta" />
                          <FunctionDoc name="process-driver-queue" description="Processa fila de entregadores" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="customers">
                      <AccordionTrigger>Clientes</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <FunctionDoc name="lookup-customer" description="Busca cliente por telefone" />
                          <FunctionDoc name="send-verification-code" description="Envia código de verificação" />
                          <FunctionDoc name="verify-email-code" description="Valida código de e-mail" />
                          <FunctionDoc name="register-referred-customer" description="Registra indicação" />
                          <FunctionDoc name="get-customer-credits" description="Consulta créditos do cliente" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="admin">
                      <AccordionTrigger>Administrativo</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <FunctionDoc name="bootstrap-superadmin" description="Cria primeiro super admin" />
                          <FunctionDoc name="create-store-staff" description="Adiciona funcionário à loja" />
                          <FunctionDoc name="delete-company" description="Remove empresa e dados" />
                          <FunctionDoc name="get-system-logs" description="Consulta logs do sistema" />
                          <FunctionDoc name="check-inactive-companies" description="CRON: detecta inatividade" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="integrations">
                      <AccordionTrigger>Integrações</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <FunctionDoc name="get-mapbox-token" description="Retorna token do Mapbox" />
                          <FunctionDoc name="get-vapid-key" description="Chave VAPID para push" />
                          <FunctionDoc name="process-nfe" description="Processa nota fiscal" />
                          <FunctionDoc name="smart-suggestions" description="IA: sugestões inteligentes" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structure">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-5 w-5" />
                  Estrutura do Projeto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <pre className="text-sm font-mono bg-muted p-4 rounded-lg">
{`src/
├── components/
│   ├── auth/           # Formulários de login/registro
│   ├── drivers/        # Componentes de entregadores
│   ├── features/       # Compra de features
│   ├── inventory/      # Gestão de estoque
│   ├── layout/         # Layout, sidebar, navbar
│   ├── lottery/        # Sistema de sorteio
│   ├── map/            # Mapas e rotas
│   ├── menu/           # Cardápio público e produtos
│   ├── onboarding/     # Onboarding de lojas
│   ├── orders/         # Gestão de pedidos
│   ├── pos/            # Ponto de venda
│   ├── store/          # Configurações da loja
│   ├── tables/         # Mesas e atendimento
│   └── ui/             # shadcn/ui components
│
├── hooks/
│   ├── useAuth.tsx     # Autenticação e RBAC
│   ├── useCart.tsx     # Carrinho de compras
│   ├── useFeatureAccess.ts
│   ├── useRealtimeOrders.ts
│   ├── useSubscriptionStatus.ts
│   └── ...
│
├── pages/
│   ├── admin/          # Páginas super admin
│   ├── store/          # Páginas do lojista
│   ├── Auth.tsx        # Login/Registro
│   ├── Dashboard.tsx   # Dashboard principal
│   ├── PublicMenu.tsx  # Cardápio público
│   └── ...
│
├── integrations/
│   └── supabase/
│       ├── client.ts   # Cliente Supabase
│       └── types.ts    # Tipos gerados
│
├── lib/
│   ├── utils.ts        # Funções utilitárias
│   ├── storeHours.ts   # Horário de funcionamento
│   └── pushNotifications.ts
│
└── index.css           # Estilos globais + design tokens

supabase/
├── functions/          # Edge Functions (Deno)
│   ├── create-pix-payment/
│   ├── send-push-notification/
│   └── ...
├── migrations/         # Migrações do banco
└── config.toml         # Configuração Supabase`}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

// Componente auxiliar para documentar tabelas
const TableDoc = ({ 
  name, 
  description, 
  columns 
}: { 
  name: string; 
  description: string; 
  columns: { name: string; type: string; description: string }[] 
}) => (
  <div className="rounded-lg border p-4">
    <div className="flex items-center gap-2 mb-2">
      <Database className="h-4 w-4 text-primary" />
      <h4 className="font-semibold">{name}</h4>
    </div>
    <p className="text-sm text-muted-foreground mb-3">{description}</p>
    <div className="space-y-1">
      {columns.map((col) => (
        <div key={col.name} className="flex items-center gap-2 text-sm">
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{col.name}</code>
          <Badge variant="outline" className="text-xs">{col.type}</Badge>
          <span className="text-muted-foreground text-xs">{col.description}</span>
        </div>
      ))}
    </div>
  </div>
);

// Componente auxiliar para documentar funções
const FunctionDoc = ({ name, description }: { name: string; description: string }) => (
  <div className="flex items-center justify-between p-2 rounded bg-muted">
    <code className="text-sm font-medium">{name}</code>
    <span className="text-xs text-muted-foreground">{description}</span>
  </div>
);

export default DevDocs;
