export interface Friend {
  memberId: number;
  nickname: string;
  avatarUrl?: string;
  level: number;
  isOnline: boolean;
  acceptedAt: string;
}

export interface FriendRequest {
  memberId: number;
  nickname: string;
  avatarUrl?: string;
  requestedAt: string;
}

export interface FriendSearchResult {
  memberId: number;
  nickname: string;
  avatarUrl?: string;
  level: number;
  status: string;
}

export interface FriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  friendRequestCount?: number;
  onRequestCountChange?: (count: number) => void;
} 