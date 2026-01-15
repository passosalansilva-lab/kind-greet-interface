import { useState, useRef, useEffect, useCallback } from 'react';
import { ScanBarcode, X, Loader2, Camera, Keyboard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { parseComandaBarcode } from './PrintComanda';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BarcodeScannerProps {
  onScan: (comandaNumber: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function BarcodeScanner({ onScan, isLoading, className }: BarcodeScannerProps) {
  const [isActive, setIsActive] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scannerRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when scanner is active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Handle barcode input - barcode scanners typically type fast and end with Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        processBarcode(inputValue.trim());
      }
    },
    [inputValue, onScan]
  );

  const processBarcode = (value: string) => {
    const parsed = parseComandaBarcode(value);
    if (parsed !== null) {
      setLastScan(value);
      onScan(parsed);
      setInputValue('');
      setShowCameraScanner(false);
      stopCameraScanner();
    }
  };

  // Auto-submit after a short delay (for scanners that don't send Enter)
  useEffect(() => {
    if (inputValue.length >= 4) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        processBarcode(inputValue.trim());
      }, 500);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [inputValue, onScan]);

  // Global keyboard listener for quick activation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2 to toggle scanner mode
      if (e.key === 'F2') {
        e.preventDefault();
        setIsActive((prev) => !prev);
      }
      // Escape to close
      if (e.key === 'Escape' && isActive) {
        setIsActive(false);
        setInputValue('');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isActive]);

  // Camera scanner logic
  const startCameraScanner = async () => {
    setCameraError(null);
    
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      if (!videoContainerRef.current) return;
      
      scannerRef.current = new Html5Qrcode('camera-scanner-container');
      
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.5,
        },
        (decodedText: string) => {
          processBarcode(decodedText);
        },
        () => {
          // Ignore errors during scanning
        }
      );
    } catch (err: any) {
      console.error('Camera scanner error:', err);
      setCameraError(
        err.message?.includes('Permission') 
          ? 'Permissão de câmera negada. Permita o acesso nas configurações do navegador.'
          : 'Não foi possível acessar a câmera. Verifique as permissões.'
      );
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  useEffect(() => {
    if (showCameraScanner) {
      // Small delay to ensure the container is rendered
      const timer = setTimeout(startCameraScanner, 100);
      return () => clearTimeout(timer);
    } else {
      stopCameraScanner();
    }
  }, [showCameraScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  if (!isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsActive(true)}
        className={cn('gap-2', className)}
      >
        <ScanBarcode className="h-4 w-4" />
        <span className="hidden sm:inline">Scanner</span>
        <Badge variant="secondary" className="text-xs px-1.5">
          F2
        </Badge>
      </Button>
    );
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg border-2 border-primary bg-primary/5',
          className
        )}
      >
        <ScanBarcode className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Escaneie ou digite o código..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pr-8 bg-background"
            autoComplete="off"
            autoFocus
          />
          {isLoading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>
        {/* Camera button for mobile */}
        <Button
          variant="default"
          size="icon"
          onClick={() => setShowCameraScanner(true)}
          className="h-9 w-9 shrink-0"
          title="Usar câmera do celular"
        >
          <Camera className="h-4 w-4" />
        </Button>
        {lastScan && (
          <Badge variant="secondary" className="hidden md:flex">
            Último: {lastScan}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsActive(false);
            setInputValue('');
          }}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Camera Scanner Dialog */}
      <Dialog open={showCameraScanner} onOpenChange={(open) => {
        setShowCameraScanner(open);
        if (!open) stopCameraScanner();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Escanear com Câmera
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Camera view */}
            <div 
              ref={videoContainerRef}
              id="camera-scanner-container" 
              className="w-full aspect-[4/3] bg-black rounded-lg overflow-hidden"
            />
            
            {cameraError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {cameraError}
              </div>
            )}
            
            <p className="text-sm text-muted-foreground text-center">
              Aponte a câmera para o código de barras da comanda
            </p>

            {/* Manual input fallback */}
            <div className="relative">
              <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Ou digite o código manualmente..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue.trim()) {
                    processBarcode(inputValue.trim());
                  }
                }}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCameraScanner(false)}
              >
                Cancelar
              </Button>
              {inputValue && (
                <Button
                  className="flex-1"
                  onClick={() => processBarcode(inputValue.trim())}
                >
                  Buscar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
