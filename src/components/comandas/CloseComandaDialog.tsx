import { useState, useEffect } from 'react';
import { Check, Loader2, Banknote, CreditCard, QrCode } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';

type PaymentMethod = 'dinheiro' | 'cartao' | 'pix';

interface CloseComandaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comandaNumber: number;
  total: number;
  onConfirm: (paymentMethod: PaymentMethod, amountReceived: number, changeAmount: number) => Promise<void>;
  isLoading: boolean;
}

const paymentMethods: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'cartao', label: 'Cartão', icon: CreditCard },
  { value: 'pix', label: 'PIX', icon: QrCode },
];

export function CloseComandaDialog({
  open,
  onOpenChange,
  comandaNumber,
  total,
  onConfirm,
  isLoading,
}: CloseComandaDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [changeAmount, setChangeAmount] = useState<number>(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPaymentMethod('dinheiro');
      setAmountReceived(0);
      setChangeAmount(0);
    }
  }, [open]);

  // Calculate change when amount received changes (only for cash)
  useEffect(() => {
    if (paymentMethod === 'dinheiro' && amountReceived > 0) {
      const change = amountReceived - total;
      setChangeAmount(change >= 0 ? change : 0);
    } else {
      setChangeAmount(0);
    }
  }, [amountReceived, total, paymentMethod]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleAmountChange = (value: string) => {
    const numericValue = parseFloat(value) || 0;
    setAmountReceived(numericValue);
  };

  const handleConfirm = async () => {
    const received = paymentMethod === 'dinheiro' && amountReceived > 0
      ? amountReceived 
      : total;
    await onConfirm(paymentMethod, received, changeAmount);
  };

  const isValidPayment = () => {
    if (paymentMethod !== 'dinheiro') return true;
    if (amountReceived === 0) return true; // Allow closing without specifying amount
    return amountReceived >= total;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar Comanda #{comandaNumber}</DialogTitle>
          <DialogDescription>
            Selecione o método de pagamento para fechar esta comanda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Total */}
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <div className="text-sm text-muted-foreground">Total da Comanda</div>
            <div className="text-3xl font-bold text-primary">{formatCurrency(total)}</div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label>Método de Pagamento</Label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all',
                      paymentMethod === method.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:border-primary/50 hover:bg-muted'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Received (only for cash) */}
          {paymentMethod === 'dinheiro' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amountReceived">Valor Recebido (opcional)</Label>
                <CurrencyInput
                  id="amountReceived"
                  value={amountReceived > 0 ? amountReceived : ''}
                  onChange={handleAmountChange}
                  placeholder="0,00"
                  className="text-lg"
                  showPrefix
                />
              </div>

              {/* Change Display */}
              {amountReceived > 0 && (
                <div
                  className={cn(
                    'rounded-lg p-4 text-center',
                    amountReceived >= total ? 'bg-green-500/10' : 'bg-destructive/10'
                  )}
                >
                  <div className="text-sm text-muted-foreground">
                    {amountReceived >= total ? 'Troco' : 'Valor Insuficiente'}
                  </div>
                  <div
                    className={cn(
                      'text-2xl font-bold',
                      amountReceived >= total ? 'text-green-600' : 'text-destructive'
                    )}
                  >
                    {amountReceived >= total 
                      ? formatCurrency(changeAmount) 
                      : formatCurrency(total - amountReceived)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !isValidPayment()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Fechar Comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
