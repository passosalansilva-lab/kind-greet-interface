import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Newspaper,
  Video,
  Youtube,
  Upload,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  MoreVertical,
  MessageCircle,
  Heart,
  Loader2,
  Calendar,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PortalPost {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  video_type: "youtube" | "upload" | null;
  image_url: string | null;
  is_published: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  reaction_count?: number;
  comment_count?: number;
}

export default function AdminPortal() {
  const [posts, setPosts] = useState<PortalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PortalPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    video_url: "",
    video_type: "" as "" | "youtube" | "upload",
    image_url: "",
    is_published: true,
    pinned: false,
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      // Fetch posts with reaction and comment counts
      const { data: postsData, error: postsError } = await (supabase as any)
        .from("portal_posts")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // Get counts for each post
      const postsWithCounts = await Promise.all(
        (postsData || []).map(async (post: PortalPost) => {
          const [{ count: reactionCount }, { count: commentCount }] = await Promise.all([
            (supabase as any)
              .from("portal_post_reactions")
              .select("*", { count: "exact", head: true })
              .eq("post_id", post.id),
            (supabase as any)
              .from("portal_post_comments")
              .select("*", { count: "exact", head: true })
              .eq("post_id", post.id),
          ]);
          return {
            ...post,
            reaction_count: reactionCount || 0,
            comment_count: commentCount || 0,
          };
        })
      );

      setPosts(postsWithCounts);
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      toast.error("Erro ao carregar posts");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim() || null,
        video_url: formData.video_url.trim() || null,
        video_type: formData.video_type || null,
        image_url: formData.image_url.trim() || null,
        is_published: formData.is_published,
        pinned: formData.pinned,
        updated_at: new Date().toISOString(),
      };

      if (editingPost) {
        const { error } = await (supabase as any)
          .from("portal_posts")
          .update(payload)
          .eq("id", editingPost.id);

        if (error) throw error;
        toast.success("Post atualizado!");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from("portal_posts")
          .insert({
            ...payload,
            created_by: userData.user?.id,
          });

        if (error) throw error;
        toast.success("Post criado!");
      }

      fetchPosts();
      resetForm();
    } catch (error: any) {
      console.error("Error saving post:", error);
      toast.error("Erro ao salvar post");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este post?")) return;

    try {
      const { error } = await (supabase as any)
        .from("portal_posts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Post excluído!");
      fetchPosts();
    } catch (error: any) {
      console.error("Error deleting post:", error);
      toast.error("Erro ao excluir post");
    }
  };

  const togglePin = async (post: PortalPost) => {
    try {
      const { error } = await (supabase as any)
        .from("portal_posts")
        .update({ pinned: !post.pinned })
        .eq("id", post.id);

      if (error) throw error;
      toast.success(post.pinned ? "Post desafixado" : "Post fixado no topo!");
      fetchPosts();
    } catch (error: any) {
      console.error("Error toggling pin:", error);
      toast.error("Erro ao alterar fixação");
    }
  };

  const togglePublish = async (post: PortalPost) => {
    try {
      const { error } = await (supabase as any)
        .from("portal_posts")
        .update({ is_published: !post.is_published })
        .eq("id", post.id);

      if (error) throw error;
      toast.success(post.is_published ? "Post despublicado" : "Post publicado!");
      fetchPosts();
    } catch (error: any) {
      console.error("Error toggling publish:", error);
      toast.error("Erro ao alterar publicação");
    }
  };

  const handleEdit = (post: PortalPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      content: post.content || "",
      video_url: post.video_url || "",
      video_type: post.video_type || "",
      image_url: post.image_url || "",
      is_published: post.is_published,
      pinned: post.pinned,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      video_url: "",
      video_type: "",
      image_url: "",
      is_published: true,
      pinned: false,
    });
    setEditingPost(null);
    setDialogOpen(false);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Por favor, selecione um arquivo de vídeo");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error("Vídeo muito grande. Máximo: 500MB");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("portal-videos")
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("portal-videos")
        .getPublicUrl(fileName);

      setFormData((prev) => ({
        ...prev,
        video_url: urlData.publicUrl,
        video_type: "upload",
      }));
      toast.success("Vídeo enviado!");
    } catch (error: any) {
      console.error("Error uploading video:", error);
      toast.error("Erro ao enviar vídeo");
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("portal-videos")
        .upload(`images/${fileName}`, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("portal-videos")
        .getPublicUrl(`images/${fileName}`);

      setFormData((prev) => ({
        ...prev,
        image_url: urlData.publicUrl,
      }));
      toast.success("Imagem enviada!");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const extractYoutubeId = (url: string) => {
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    );
    return match ? match[1] : null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Newspaper className="h-8 w-8 text-primary" />
              Portal de Novidades
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie posts, vídeos e novidades para os lojistas
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) resetForm();
            setDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Post
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPost ? "Editar Post" : "Novo Post"}
                </DialogTitle>
                <DialogDescription>
                  Crie um post para compartilhar com todos os lojistas
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Nova funcionalidade de delivery"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Conteúdo</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="Descreva a novidade em detalhes..."
                    rows={5}
                  />
                </div>

                {/* Video Section */}
                <div className="space-y-3">
                  <Label>Vídeo (opcional)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.video_type}
                      onValueChange={(value) => setFormData((prev) => ({
                        ...prev,
                        video_type: value as "" | "youtube" | "upload",
                        video_url: value !== prev.video_type ? "" : prev.video_url,
                      }))}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube">
                          <span className="flex items-center gap-2">
                            <Youtube className="h-4 w-4 text-red-500" />
                            YouTube
                          </span>
                        </SelectItem>
                        <SelectItem value="upload">
                          <span className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            Upload
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {formData.video_type === "youtube" && (
                      <Input
                        value={formData.video_url}
                        onChange={(e) => setFormData((prev) => ({ ...prev, video_url: e.target.value }))}
                        placeholder="Cole o link do YouTube"
                        className="flex-1"
                      />
                    )}

                    {formData.video_type === "upload" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => videoInputRef.current?.click()}
                          disabled={uploading}
                          className="flex-1"
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {formData.video_url ? "Trocar vídeo" : "Enviar vídeo"}
                        </Button>
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/*"
                          onChange={handleVideoUpload}
                          className="hidden"
                        />
                      </>
                    )}
                  </div>

                  {formData.video_url && formData.video_type === "youtube" && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <iframe
                        src={`https://www.youtube.com/embed/${extractYoutubeId(formData.video_url)}`}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {formData.video_url && formData.video_type === "upload" && (
                    <video
                      src={formData.video_url}
                      controls
                      className="w-full rounded-lg"
                    />
                  )}
                </div>

                {/* Image Section */}
                <div className="space-y-3">
                  <Label>Imagem de capa (opcional)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      {formData.image_url ? "Trocar imagem" : "Adicionar imagem"}
                    </Button>
                    {formData.image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData((prev) => ({ ...prev, image_url: "" }))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>

                  {formData.image_url && (
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="w-full max-h-48 object-cover rounded-lg"
                    />
                  )}
                </div>

                {/* Options */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="published"
                      checked={formData.is_published}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, is_published: checked }))
                      }
                    />
                    <Label htmlFor="published" className="font-normal">
                      Publicar imediatamente
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="pinned"
                      checked={formData.pinned}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, pinned: checked }))
                      }
                    />
                    <Label htmlFor="pinned" className="font-normal">
                      Fixar no topo
                    </Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingPost ? "Salvar alterações" : "Publicar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhum post criado ainda.
                <br />
                Clique em "Novo Post" para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => (
              <Card key={post.id} className={!post.is_published ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {post.pinned && (
                          <Badge variant="secondary" className="gap-1">
                            <Pin className="h-3 w-3" />
                            Fixado
                          </Badge>
                        )}
                        {!post.is_published && (
                          <Badge variant="outline" className="gap-1">
                            <EyeOff className="h-3 w-3" />
                            Rascunho
                          </Badge>
                        )}
                        {post.video_type === "youtube" && (
                          <Badge variant="outline" className="gap-1 text-red-500 border-red-200">
                            <Youtube className="h-3 w-3" />
                            YouTube
                          </Badge>
                        )}
                        {post.video_type === "upload" && (
                          <Badge variant="outline" className="gap-1">
                            <Video className="h-3 w-3" />
                            Vídeo
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{post.title}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(post.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" />
                          {post.reaction_count} curtidas
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {post.comment_count} comentários
                        </span>
                      </CardDescription>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(post)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePin(post)}>
                          {post.pinned ? (
                            <>
                              <PinOff className="h-4 w-4 mr-2" />
                              Desafixar
                            </>
                          ) : (
                            <>
                              <Pin className="h-4 w-4 mr-2" />
                              Fixar no topo
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePublish(post)}>
                          {post.is_published ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Despublicar
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Publicar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(post.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                {(post.content || post.image_url) && (
                  <CardContent>
                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt={post.title}
                        className="w-full max-h-64 object-cover rounded-lg mb-3"
                      />
                    )}
                    {post.content && (
                      <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {post.content}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
