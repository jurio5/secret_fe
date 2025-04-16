export interface Avatar {
  id: number;
  fileName: string;
  price: number;
  status?: string; // 소유한 아바타일 경우 상태 정보
  url: string;
}

export interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPoints?: number;
  onAvatarPurchased?: () => void;
  userId?: number;
}

export interface AvatarCardProps {
  avatar: Avatar;
  isOwned: boolean;
  isEquipped: boolean;
  onPurchase: (avatarId: number) => void;
  onEquip: (avatarId: number) => void;
  currentPoints: number;
  isLoading?: boolean;
} 