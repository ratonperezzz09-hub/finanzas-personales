import {
  Bus,
  Clapperboard,
  Lightbulb,
  ShoppingBag,
  Utensils,
} from 'lucide-react';
import { CATEGORY_META, type ExpenseCategory } from '../data/budgetData';

interface CategoryIconProps {
  category: ExpenseCategory;
  size?: 'sm' | 'md';
}

export function CategoryIcon({ category, size = 'md' }: CategoryIconProps) {
  const meta = CATEGORY_META[category];
  const boxSize = size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';

  const renderIcon = () => {
    switch (category) {
      case 'Alimentación':
        return <Utensils className={iconSize} strokeWidth={1.9} aria-hidden="true" />;
      case 'Transporte':
        return <Bus className={iconSize} strokeWidth={1.9} aria-hidden="true" />;
      case 'Servicios públicos':
        return <Lightbulb className={iconSize} strokeWidth={1.9} aria-hidden="true" />;
      case 'Ropa y compras personales':
        return <ShoppingBag className={iconSize} strokeWidth={1.9} aria-hidden="true" />;
      case 'Entretenimiento y ocio':
        return <Clapperboard className={iconSize} strokeWidth={1.9} aria-hidden="true" />;
    }
  };

  return (
    <div
      className={`${boxSize} ${meta.iconBgClass} ${meta.iconTextClass} flex items-center justify-center shrink-0`}
    >
      {renderIcon()}
    </div>
  );
}
