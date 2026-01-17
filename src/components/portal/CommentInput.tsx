import { useState, memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2, X } from "lucide-react";

interface CommentInputProps {
  postId: string;
  parentId?: string;
  onSubmit: (postId: string, content: string, parentId?: string) => Promise<void>;
  placeholder?: string;
  compact?: boolean;
  onCancel?: () => void;
}

export const CommentInput = memo(function CommentInput({ 
  postId, 
  parentId,
  onSubmit, 
  placeholder = "Escreva um comentário...",
  compact = false,
  onCancel
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      await onSubmit(postId, content.trim(), parentId);
      setContent("");
      onCancel?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`flex gap-2 ${compact ? "items-center" : ""}`}>
      <Textarea
        placeholder={placeholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={compact ? 1 : 2}
        className={`flex-1 resize-none ${compact ? "min-h-[36px] py-2" : ""}`}
      />
      <div className="flex gap-1 shrink-0">
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="ghost"
            size="icon"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          size="icon"
          className="shrink-0"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
});
