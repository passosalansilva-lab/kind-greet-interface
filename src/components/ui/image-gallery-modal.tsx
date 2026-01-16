import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Image as ImageIcon, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GalleryImage {
  name: string;
  url: string;
  createdAt: string;
}

interface ImageGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  companyId: string;
}

export function ImageGalleryModal({
  open,
  onClose,
  onSelect,
  companyId,
}: ImageGalleryModalProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<GalleryImage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && companyId) {
      loadImages();
    }
  }, [open, companyId]);

  const loadImages = async () => {
    try {
      setLoading(true);
      
      // Listar imagens da pasta da empresa
      const { data: files, error } = await supabase.storage
        .from('images')
        .list(companyId, {
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      // Filtrar apenas imagens (não pastas)
      const imageFiles = (files || []).filter(f => 
        f.name && !f.name.endsWith('/') && f.metadata
      );

      // Gerar URLs públicas
      const imagesWithUrls: GalleryImage[] = imageFiles.map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(`${companyId}/${file.name}`);
        
        return {
          name: file.name,
          url: publicUrl,
          createdAt: file.created_at || '',
        };
      });

      setImages(imagesWithUrls);
    } catch (error) {
      console.error('Erro ao carregar galeria:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedUrl) {
      onSelect(selectedUrl);
      onClose();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, image: GalleryImage) => {
    e.stopPropagation();
    setImageToDelete(image);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!imageToDelete) return;

    setDeleting(true);
    try {
      const filePath = `${companyId}/${imageToDelete.name}`;
      
      const { error } = await supabase.storage
        .from('images')
        .remove([filePath]);

      if (error) throw error;

      // Remover da lista local
      setImages(prev => prev.filter(img => img.name !== imageToDelete.name));
      
      // Se a imagem deletada estava selecionada, limpar seleção
      if (selectedUrl === imageToDelete.url) {
        setSelectedUrl(null);
      }

      toast({
        title: 'Imagem excluída',
        description: 'A imagem foi removida da galeria.',
      });
    } catch (error: any) {
      console.error('Erro ao excluir imagem:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir a imagem.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setImageToDelete(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Galeria de Imagens
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Nenhuma imagem na galeria ainda.
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                As imagens que você enviar para produtos ficarão disponíveis aqui.
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((image) => (
                    <div
                      key={image.name}
                      className="relative group"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedUrl(image.url === selectedUrl ? null : image.url)}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:opacity-90 w-full",
                          selectedUrl === image.url
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-primary/30"
                        )}
                      >
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                        {selectedUrl === image.url && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="bg-primary text-primary-foreground rounded-full p-1">
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                      </button>
                      
                      {/* Botão de excluir */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, image)}
                        className="absolute top-1 right-1 p-1.5 bg-destructive text-destructive-foreground rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90 z-10"
                        title="Excluir imagem"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button onClick={handleSelect} disabled={!selectedUrl}>
                  Usar imagem selecionada
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A imagem será permanentemente removida da galeria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
