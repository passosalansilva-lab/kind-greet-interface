import { useState, useRef, useEffect, useCallback } from 'react';
import { ScanBarcode, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { parseComandaBarcode } from './PrintComanda';

interface BarcodeScannerProps {
  onScan: (comandaNumber: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function BarcodeScanner({ onScan, isLoading, className }: BarcodeScannerProps) {
  const [isActive, setIsActive] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when scanner is active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Clear input and refocus after scan completes (when loading finishes)
  useEffect(() => {
    if (!isLoading && lastScan && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isLoading, lastScan]);

  const handleSubmit = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;
    
    const parsed = parseComandaBarcode(trimmedValue);
    if (parsed !== null) {
      setLastScan(trimmedValue);
      setInputValue(''); // Clear immediately
      onScan(parsed);
    } else {
      // Invalid barcode - just clear
      setInputValue('');
    }
  }, [inputValue, onScan]);

  // Handle keyboard input - only submit on Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

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
          placeholder="Escaneie ou digite + Enter..."
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
      <Button
        variant="default"
        size="sm"
        onClick={handleSubmit}
        disabled={!inputValue.trim() || isLoading}
        className="shrink-0"
      >
        Buscar
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
  );
}
