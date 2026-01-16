import { useState, useRef } from 'react';
import { Upload, X, Loader2, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImageGalleryModal } from './image-gallery-modal';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  aspectRatio?: 'square' | 'video' | 'banner';
  className?: string;
  showGallery?: boolean;
  companyId?: string;
}

// Função para calcular hash simples do arquivo
async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function ImageUpload({
  value,
  onChange,
  folder,
  aspectRatio = 'square',
  className,
  showGallery = false,
  companyId,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    banner: 'aspect-[3/1]',
  };

  // Verificar se já existe uma imagem com o mesmo hash
  const checkForDuplicate = async (hash: string): Promise<string | null> => {
    try {
      const { data: files, error } = await supabase.storage
        .from('images')
        .list(folder, {
          search: hash.substring(0, 16), // Busca pelo início do hash no nome
        });

      if (error || !files || files.length === 0) return null;

      // Verifica se algum arquivo tem o hash no nome
      const existingFile = files.find(f => f.name.includes(hash.substring(0, 16)));
      
      if (existingFile) {
        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(`${folder}/${existingFile.name}`);
        return publicUrl;
      }

      return null;
    } catch {
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Calcular hash do arquivo para detectar duplicatas
      const fileHash = await calculateFileHash(file);
      
      // Verificar se já existe
      const existingUrl = await checkForDuplicate(fileHash);
      
      if (existingUrl) {
        // Imagem já existe, usar a existente
        onChange(existingUrl);
        toast({
          title: 'Imagem já existe',
          description: 'Usando a imagem existente da galeria.',
        });
        return;
      }

      // Gerar nome único com hash para identificação futura
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${fileHash.substring(0, 16)}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast({
        title: 'Imagem enviada',
        description: 'A imagem foi enviada com sucesso',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Não foi possível enviar a imagem',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {value ? (
        <div className={cn('relative rounded-xl overflow-hidden border border-border', aspectClasses[aspectRatio])}>
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground',
              aspectClasses[aspectRatio],
              uploading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <span className="text-sm">Clique para enviar</span>
              </>
            )}
          </button>
          
          {showGallery && companyId && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setGalleryOpen(true)}
            >
              <Images className="h-4 w-4 mr-2" />
              Escolher da galeria
            </Button>
          )}
        </div>
      )}

      {showGallery && companyId && (
        <ImageGalleryModal
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          onSelect={onChange}
          companyId={companyId}
        />
      )}
    </div>
  );
}
