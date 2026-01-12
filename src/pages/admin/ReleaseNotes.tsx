import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Rocket, Bug, Sparkles, Wrench, AlertCircle, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  description: string;
  type: "feature" | "bugfix" | "improvement" | "breaking";
  created_at: string;
  published: boolean;
}

const typeConfig = {
  feature: { label: "Nova Funcionalidade", icon: Sparkles, color: "bg-green-500/10 text-green-600 border-green-500/20" },
  bugfix: { label: "Correção de Bug", icon: Bug, color: "bg-red-500/10 text-red-600 border-red-500/20" },
  improvement: { label: "Melhoria", icon: Wrench, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  breaking: { label: "Alteração Importante", icon: AlertCircle, color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

export default function ReleaseNotes() {
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ReleaseNote | null>(null);
  const [formData, setFormData] = useState({
    version: "",
    title: "",
    description: "",
    type: "feature" as ReleaseNote["type"],
    published: true,
  });

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("release_notes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching release notes:", error);
      toast.error("Erro ao carregar notas de versão");
    } else {
      setNotes((data as ReleaseNote[]) || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.version || !formData.title || !formData.description) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (editingNote) {
      const { error } = await (supabase as any)
        .from("release_notes")
        .update({
          version: formData.version,
          title: formData.title,
          description: formData.description,
          type: formData.type,
          published: formData.published,
        })
        .eq("id", editingNote.id);

      if (error) {
        console.error("Error updating release note:", error);
        toast.error("Erro ao atualizar nota de versão");
      } else {
        toast.success("Nota de versão atualizada!");
        fetchNotes();
        resetForm();
      }
    } else {
      const { error } = await (supabase as any)
        .from("release_notes")
        .insert({
          version: formData.version,
          title: formData.title,
          description: formData.description,
          type: formData.type,
          published: formData.published,
        });

      if (error) {
        console.error("Error creating release note:", error);
        toast.error("Erro ao criar nota de versão");
      } else {
        toast.success("Nota de versão criada!");
        fetchNotes();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta nota de versão?")) return;

    const { error } = await (supabase as any)
      .from("release_notes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting release note:", error);
      toast.error("Erro ao excluir nota de versão");
    } else {
      toast.success("Nota de versão excluída!");
      fetchNotes();
    }
  };

  const handleEdit = (note: ReleaseNote) => {
    setEditingNote(note);
    setFormData({
      version: note.version,
      title: note.title,
      description: note.description,
      type: note.type,
      published: note.published,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      version: "",
      title: "",
      description: "",
      type: "feature",
      published: true,
    });
    setEditingNote(null);
    setDialogOpen(false);
  };

  const groupedNotes = notes.reduce((acc, note) => {
    if (!acc[note.version]) {
      acc[note.version] = [];
    }
    acc[note.version].push(note);
    return acc;
  }, {} as Record<string, ReleaseNote[]>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Rocket className="h-8 w-8 text-primary" />
              Notas de Versão
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o histórico de atualizações e novidades do sistema
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) resetForm();
            setDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Nota
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingNote ? "Editar Nota de Versão" : "Nova Nota de Versão"}
                </DialogTitle>
                <DialogDescription>
                  Adicione uma nova entrada no histórico de atualizações
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="version">Versão *</Label>
                    <Input
                      id="version"
                      placeholder="Ex: 1.2.0"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value as ReleaseNote["type"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(typeConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              {config.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Título da atualização"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva as mudanças desta versão..."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="published"
                    checked={formData.published}
                    onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="published" className="text-sm">
                    Publicar imediatamente
                  </Label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  {editingNote ? "Salvar Alterações" : "Criar Nota"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : notes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhuma nota de versão</h3>
              <p className="text-muted-foreground text-sm">
                Adicione a primeira nota de versão clicando no botão acima
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedNotes).map(([version, versionNotes]) => (
              <div key={version} className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="outline" className="text-lg px-4 py-1 font-mono">
                    <Tag className="h-4 w-4 mr-2" />
                    v{version}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(versionNotes[0].created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>

                <div className="space-y-3 pl-4 border-l-2 border-muted">
                  {versionNotes.map((note) => {
                    const config = typeConfig[note.type];
                    const Icon = config.icon;

                    return (
                      <Card key={note.id} className="relative">
                        <div className="absolute -left-[1.35rem] top-6 w-3 h-3 rounded-full bg-primary border-2 border-background"></div>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={config.color}>
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                              {!note.published && (
                                <Badge variant="secondary">Rascunho</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(note)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(note.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <CardTitle className="text-lg">{note.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {note.description}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
