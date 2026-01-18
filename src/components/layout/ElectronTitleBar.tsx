import { Minus, Square, X } from 'lucide-react';

interface ElectronTitleBarProps {
  onClose?: () => void;
  title?: string;
}

export function ElectronTitleBar({ onClose, title = "Cardápio On Desktop" }: ElectronTitleBarProps) {
  // Detect if running inside Electron (desktop app)
  const isElectronApp = typeof navigator !== 'undefined' && 
    (navigator.userAgent.toLowerCase().includes('electron') || 
     (window as any).process?.versions?.electron);

  if (!isElectronApp) return null;

  const handleMinimize = () => {
    (window as any).electronAPI?.minimize?.();
  };

  const handleMaximize = () => {
    (window as any).electronAPI?.maximize?.();
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.close();
    }
  };

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-8 bg-background/95 backdrop-blur-sm border-b border-border z-[60] flex items-center justify-between px-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-[11px] text-muted-foreground font-medium select-none">
        {title}
      </span>
      <div 
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Minimizar"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Maximizar"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Hook to check if we're in Electron
export function useIsElectron() {
  return typeof navigator !== 'undefined' && 
    (navigator.userAgent.toLowerCase().includes('electron') || 
     (window as any).process?.versions?.electron);
}
