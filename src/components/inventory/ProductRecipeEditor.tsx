import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
}

interface RecipeItem {
  id?: string;
  ingredient_id: string;
  quantity_per_unit: number;
  ingredient?: Ingredient;
}

interface ProductRecipeEditorProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  companyId: string;
}

export function ProductRecipeEditor({
  open,
  onClose,
  productId,
  productName,
  companyId,
}: ProductRecipeEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [newItem, setNewItem] = useState<{
    ingredient_id: string;
    quantity: string;
  }>({ ingredient_id: '', quantity: '' });

  useEffect(() => {
    if (open && productId) {
      loadData();
    }
  }, [open, productId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [{ data: ingredientsData, error: ingredientsError }, { data: recipeData, error: recipeError }] =
        await Promise.all([
          supabase
            .from('inventory_ingredients')
            .select('id, name, unit, current_stock')
            .eq('company_id', companyId)
            .order('name'),
          supabase
            .from('inventory_product_ingredients')
            .select(`
              id,
              ingredient_id,
              quantity_per_unit,
              inventory_ingredients (id, name, unit, current_stock)
            `)
            .eq('product_id', productId),
        ]);

      if (ingredientsError) throw ingredientsError;
      if (recipeError) throw recipeError;

      setIngredients(ingredientsData || []);
      setRecipeItems(
        (recipeData || []).map((item: any) => ({
          id: item.id,
          ingredient_id: item.ingredient_id,
          quantity_per_unit: Number(item.quantity_per_unit),
          ingredient: item.inventory_ingredients,
        }))
      );
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.ingredient_id || !newItem.quantity) return;

    const quantity = parseFloat(newItem.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se já existe
    if (recipeItems.some((item) => item.ingredient_id === newItem.ingredient_id)) {
      toast({
        title: 'Ingrediente já adicionado',
        description: 'Este ingrediente já está na ficha técnica.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('inventory_product_ingredients')
        .insert({
          product_id: productId,
          company_id: companyId,
          ingredient_id: newItem.ingredient_id,
          quantity_per_unit: quantity,
        })
        .select(`
          id,
          ingredient_id,
          quantity_per_unit,
          inventory_ingredients (id, name, unit, current_stock)
        `)
        .single();

      if (error) throw error;

      setRecipeItems([
        ...recipeItems,
        {
          id: data.id,
          ingredient_id: data.ingredient_id,
          quantity_per_unit: Number(data.quantity_per_unit),
          ingredient: data.inventory_ingredients as any,
        },
      ]);

      setNewItem({ ingredient_id: '', quantity: '' });
      toast({ title: 'Ingrediente adicionado à ficha técnica' });
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar ingrediente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('inventory_product_ingredients')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setRecipeItems(recipeItems.filter((item) => item.id !== itemId));
      toast({ title: 'Ingrediente removido da ficha técnica' });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover ingrediente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (isNaN(newQuantity) || newQuantity <= 0) return;

    try {
      const { error } = await supabase
        .from('inventory_product_ingredients')
        .update({ quantity_per_unit: newQuantity })
        .eq('id', itemId);

      if (error) throw error;

      setRecipeItems(
        recipeItems.map((item) =>
          item.id === itemId ? { ...item, quantity_per_unit: newQuantity } : item
        )
      );
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar quantidade',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const availableIngredients = ingredients.filter(
    (ing) => !recipeItems.some((item) => item.ingredient_id === ing.id)
  );

  // Get selected ingredient details for unit display
  const selectedIngredient = ingredients.find((ing) => ing.id === newItem.ingredient_id);
  const selectedUnit = selectedIngredient?.unit || '';

  // Format placeholder based on unit type
  const getPlaceholder = (unit: string) => {
    const lowerUnit = unit.toLowerCase();
    if (lowerUnit === 'kg' || lowerUnit === 'quilo' || lowerUnit === 'quilos') {
      return 'Ex: 0.5';
    }
    if (lowerUnit === 'g' || lowerUnit === 'grama' || lowerUnit === 'gramas') {
      return 'Ex: 200';
    }
    if (lowerUnit === 'ml' || lowerUnit === 'mililitro' || lowerUnit === 'mililitros') {
      return 'Ex: 100';
    }
    if (lowerUnit === 'l' || lowerUnit === 'litro' || lowerUnit === 'litros') {
      return 'Ex: 0.5';
    }
    if (lowerUnit === 'un' || lowerUnit === 'unidade' || lowerUnit === 'unidades') {
      return 'Ex: 2';
    }
    return 'Qtd';
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ficha Técnica
          </SheetTitle>
          <SheetDescription>
            Configure os ingredientes consumidos por unidade de <strong>{productName}</strong>
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Lista de ingredientes da receita */}
            <div className="space-y-3">
              <Label>Ingredientes da ficha técnica</Label>
              {recipeItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-md bg-muted/20">
                  Nenhum ingrediente vinculado a este produto.
                </p>
              ) : (
                <div className="space-y-2">
                  {recipeItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 border rounded-md bg-background"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {item.ingredient?.name || 'Ingrediente'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Estoque: {item.ingredient?.current_stock?.toFixed(2) || 0}{' '}
                          {item.ingredient?.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantity_per_unit}
                          onChange={(e) =>
                            handleUpdateQuantity(item.id!, parseFloat(e.target.value))
                          }
                          className="w-20 text-center"
                        />
                        <span className="text-sm text-muted-foreground">
                          {item.ingredient?.unit}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveItem(item.id!)}
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Adicionar novo ingrediente */}
            {availableIngredients.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <Label>Adicionar ingrediente</Label>
                <div className="flex gap-2">
                  <Select
                    value={newItem.ingredient_id}
                    onValueChange={(v) => setNewItem({ ...newItem, ingredient_id: v })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um ingrediente" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIngredients.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={getPlaceholder(selectedUnit)}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                      className="w-24"
                    />
                    {selectedUnit && (
                      <span className="text-sm text-muted-foreground font-medium min-w-[2rem]">
                        {selectedUnit}
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={handleAddItem}
                    disabled={saving || !newItem.ingredient_id || !newItem.quantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {selectedIngredient && (
                  <p className="text-xs text-muted-foreground">
                    Estoque atual: <span className="font-medium">{selectedIngredient.current_stock?.toFixed(2) || 0} {selectedUnit}</span>
                  </p>
                )}
              </div>
            )}

            {ingredients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum ingrediente cadastrado no estoque. Cadastre ingredientes primeiro.
              </p>
            )}
          </div>
        )}

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
