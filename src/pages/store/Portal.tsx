import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Newspaper,
  Heart,
  MessageCircle,
  Send,
  Pin,
  Youtube,
  Video,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_email?: string;
  company_name?: string;
}

interface PortalPost {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  video_type: "youtube" | "upload" | null;
  image_url: string | null;
  pinned: boolean;
  created_at: string;
  reaction_count: number;
  comment_count: number;
  user_reacted: boolean;
  comments?: Comment[];
}

export default function Portal() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PortalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPosts();
  }, [user?.id]);

  const fetchPosts = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Fetch published posts
      const { data: postsData, error: postsError } = await (supabase as any)
        .from("portal_posts")
        .select("*")
        .eq("is_published", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // Get counts and user reactions for each post
      const postsWithDetails = await Promise.all(
        (postsData || []).map(async (post: any) => {
          const [
            { count: reactionCount },
            { count: commentCount },
            { data: userReaction },
          ] = await Promise.all([
            (supabase as any)
              .from("portal_post_reactions")
              .select("*", { count: "exact", head: true })
              .eq("post_id", post.id),
            (supabase as any)
              .from("portal_post_comments")
              .select("*", { count: "exact", head: true })
              .eq("post_id", post.id),
            (supabase as any)
              .from("portal_post_reactions")
              .select("id")
              .eq("post_id", post.id)
              .eq("user_id", user.id)
              .maybeSingle(),
          ]);

          return {
            ...post,
            reaction_count: reactionCount || 0,
            comment_count: commentCount || 0,
            user_reacted: !!userReaction,
          };
        })
      );

      setPosts(postsWithDetails);
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      toast.error("Erro ao carregar novidades");
    } finally {
      setLoading(false);
    }
  };

  const toggleReaction = async (postId: string) => {
    if (!user?.id) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              user_reacted: !p.user_reacted,
              reaction_count: p.user_reacted ? p.reaction_count - 1 : p.reaction_count + 1,
            }
          : p
      )
    );

    try {
      if (post.user_reacted) {
        await (supabase as any)
          .from("portal_post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      } else {
        await (supabase as any)
          .from("portal_post_reactions")
          .insert({ post_id: postId, user_id: user.id });
      }
    } catch (error: any) {
      console.error("Error toggling reaction:", error);
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                user_reacted: post.user_reacted,
                reaction_count: post.reaction_count,
              }
            : p
        )
      );
    }
  };

  const toggleComments = async (postId: string) => {
    const isExpanded = expandedComments.has(postId);

    if (isExpanded) {
      setExpandedComments((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    } else {
      setExpandedComments((prev) => new Set(prev).add(postId));
      await loadComments(postId);
    }
  };

  const loadComments = async (postId: string) => {
    setLoadingComments((prev) => new Set(prev).add(postId));

    try {
      const { data: comments, error } = await (supabase as any)
        .from("portal_post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get user info for comments
      const commentsWithUserInfo = await Promise.all(
        (comments || []).map(async (comment: Comment) => {
          // Try to get company name
          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("owner_id", comment.user_id)
            .maybeSingle();

          return {
            ...comment,
            company_name: company?.name || "Usuário",
          };
        })
      );

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: commentsWithUserInfo } : p
        )
      );
    } catch (error: any) {
      console.error("Error loading comments:", error);
    } finally {
      setLoadingComments((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const submitComment = async (postId: string) => {
    if (!user?.id) return;

    const content = newComment[postId]?.trim();
    if (!content) return;

    setSubmittingComment(postId);
    try {
      const { error } = await (supabase as any)
        .from("portal_post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
        });

      if (error) throw error;

      setNewComment((prev) => ({ ...prev, [postId]: "" }));
      
      // Update comment count
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
        )
      );

      // Reload comments
      await loadComments(postId);
      toast.success("Comentário enviado!");
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      toast.error("Erro ao enviar comentário");
    } finally {
      setSubmittingComment(null);
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("portal_post_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      // Update local state
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comment_count: p.comment_count - 1,
                comments: p.comments?.filter((c) => c.id !== commentId),
              }
            : p
        )
      );
      toast.success("Comentário excluído");
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast.error("Erro ao excluir comentário");
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
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-primary" />
            Portal de Novidades
          </h1>
          <p className="text-muted-foreground mt-1">
            Fique por dentro das últimas atualizações e novidades do Cardápio On
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhuma novidade por enquanto.
                <br />
                Volte em breve para ver as atualizações!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex items-start gap-2 mb-2">
                    {post.pinned && (
                      <Badge variant="secondary" className="gap-1">
                        <Pin className="h-3 w-3" />
                        Destaque
                      </Badge>
                    )}
                    {post.video_type === "youtube" && (
                      <Badge variant="outline" className="gap-1 text-red-500 border-red-200">
                        <Youtube className="h-3 w-3" />
                        Vídeo
                      </Badge>
                    )}
                    {post.video_type === "upload" && (
                      <Badge variant="outline" className="gap-1">
                        <Video className="h-3 w-3" />
                        Vídeo
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl">{post.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(post.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Image */}
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="w-full max-h-96 object-cover rounded-lg"
                    />
                  )}

                  {/* Video */}
                  {post.video_url && post.video_type === "youtube" && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <iframe
                        src={`https://www.youtube.com/embed/${extractYoutubeId(post.video_url)}`}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {post.video_url && post.video_type === "upload" && (
                    <video
                      src={post.video_url}
                      controls
                      className="w-full rounded-lg"
                    />
                  )}

                  {/* Content */}
                  {post.content && (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {post.content}
                    </p>
                  )}
                </CardContent>

                <CardFooter className="flex-col items-stretch gap-4 pt-0">
                  {/* Actions */}
                  <div className="flex items-center gap-4 py-3 border-t border-b">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleReaction(post.id)}
                      className={post.user_reacted ? "text-red-500" : ""}
                    >
                      <Heart
                        className={`h-4 w-4 mr-2 ${post.user_reacted ? "fill-current" : ""}`}
                      />
                      {post.reaction_count} {post.reaction_count === 1 ? "curtida" : "curtidas"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(post.id)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {post.comment_count} {post.comment_count === 1 ? "comentário" : "comentários"}
                      {expandedComments.has(post.id) ? (
                        <ChevronUp className="h-4 w-4 ml-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                  </div>

                  {/* Comments Section */}
                  {expandedComments.has(post.id) && (
                    <div className="space-y-4">
                      {/* New Comment Input */}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Escreva um comentário..."
                          value={newComment[post.id] || ""}
                          onChange={(e) =>
                            setNewComment((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => submitComment(post.id)}
                          disabled={!newComment[post.id]?.trim() || submittingComment === post.id}
                          size="icon"
                        >
                          {submittingComment === post.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Comments List */}
                      {loadingComments.has(post.id) ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {post.comments?.map((comment) => (
                            <div
                              key={comment.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {(comment.company_name || "U").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-sm truncate">
                                    {comment.company_name}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {formatDistanceToNow(new Date(comment.created_at), {
                                        addSuffix: true,
                                        locale: ptBR,
                                      })}
                                    </span>
                                    {comment.user_id === user?.id && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => deleteComment(post.id, comment.id)}
                                      >
                                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {comment.content}
                                </p>
                              </div>
                            </div>
                          ))}
                          {post.comments?.length === 0 && (
                            <p className="text-center text-sm text-muted-foreground py-4">
                              Nenhum comentário ainda. Seja o primeiro!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
