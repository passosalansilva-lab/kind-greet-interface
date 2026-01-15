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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when scanner is active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);


  const submitValue = useCallback(
    (rawValue: string) => {
      const trimmedValue = rawValue.trim();
      if (!trimmedValue) return;

      setErrorMessage(null);

      const parsed = parseComandaBarcode(trimmedValue);
      if (parsed !== null) {
        setLastScan(trimmedValue);
        setInputValue(''); // clear immediately so next scan starts clean
        onScan(parsed);
        // Ensure the field is ready for the next scan
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        // Keep the typed value visible so the user can fix it
        setErrorMessage('Digite apenas o número da comanda (ex: 1, 50, 100)');
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [onScan]
  );

  const handleSubmit = useCallback(() => {
    // Use the actual DOM value to avoid state timing issues with fast scanners
    const rawValue = inputRef.current?.value ?? inputValue;
    submitValue(rawValue);
  }, [inputValue, submitValue]);

  // Handle keyboard input - only submit on Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Use DOM value here (scanner may press Enter before state updates)
        submitValue(e.currentTarget.value);
      }
    },
    [submitValue]
  );

  // Global keyboard listener for quick activation + keep focus on input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2 to toggle scanner mode
      if (e.key === 'F2') {
        e.preventDefault();
        setIsActive((prev) => !prev);
        return;
      }

      if (!isActive) return;

      // If scanner is active and user starts typing anywhere, force focus to the input
      const isTypingChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (isTypingChar && inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }

      // Escape to close
      if (e.key === 'Escape') {
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
      <div className="flex-1 min-w-[260px]">
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Nº da comanda (ex: 1, 50, 100)..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onKeyDown={handleKeyDown}
            className="pr-8 bg-background w-full"
            autoComplete="off"
            autoFocus
          />
          {isLoading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>
        {errorMessage && <p className="mt-1 text-xs text-destructive">{errorMessage}</p>}
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
        <Badge variant="secondary" className="hidden md:flex max-w-[160px] truncate">
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
