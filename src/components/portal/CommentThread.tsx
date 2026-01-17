import { useState, memo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trash2, Reply, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CommentInput } from "./CommentInput";
import { motion, AnimatePresence } from "framer-motion";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  company_name?: string;
  parent_id?: string | null;
  replies?: Comment[];
}

interface CommentThreadProps {
  comment: Comment;
  postId: string;
  userId?: string;
  onDelete: (postId: string, commentId: string) => void;
  onReply: (postId: string, content: string, parentId?: string) => Promise<void>;
  depth?: number;
}

export const CommentThread = memo(function CommentThread({
  comment,
  postId,
  userId,
  onDelete,
  onReply,
  depth = 0,
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = comment.replies && comment.replies.length > 0;
  const maxDepth = 3;

  return (
    <div className={`${depth > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""}`}>
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {(comment.company_name || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm truncate">
              {comment.company_name}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(comment.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
              {depth < maxDepth && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowReplyInput(!showReplyInput)}
                  title="Responder"
                >
                  <Reply className="h-3 w-3 text-muted-foreground hover:text-primary" />
                </Button>
              )}
              {comment.user_id === userId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onDelete(postId, comment.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {comment.content}
          </p>

          {/* Reply Input */}
          <AnimatePresence>
            {showReplyInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 overflow-hidden"
              >
                <CommentInput
                  postId={postId}
                  parentId={comment.id}
                  onSubmit={onReply}
                  placeholder={`Responder ${comment.company_name}...`}
                  compact
                  onCancel={() => setShowReplyInput(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle replies */}
          {hasReplies && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 mt-2 text-xs text-muted-foreground"
              onClick={() => setShowReplies(!showReplies)}
            >
              {showReplies ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Ocultar {comment.replies!.length} resposta{comment.replies!.length > 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Ver {comment.replies!.length} resposta{comment.replies!.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Replies */}
      <AnimatePresence>
        {hasReplies && showReplies && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 mt-2"
          >
            {comment.replies!.map((reply) => (
              <CommentThread
                key={reply.id}
                comment={reply}
                postId={postId}
                userId={userId}
                onDelete={onDelete}
                onReply={onReply}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
