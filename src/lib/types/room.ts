// 방 상태 타입
export type RoomStatus = "WAITING" | "IN_GAME" | "FINISHED";

// 난이도 타입
export type Difficulty = "EASY" | "NORMAL" | "HARD";

// 메인 카테고리 타입
export type MainCategory = "SCIENCE" | "HISTORY" | "LANGUAGE" | "GENERAL_KNOWLEDGE";

// 서브 카테고리 타입
export type SubCategory = 
  | "PHYSICS" 
  | "CHEMISTRY" 
  | "BIOLOGY" 
  | "WORLD_HISTORY" 
  | "KOREAN_HISTORY" 
  | "KOREAN" 
  | "ENGLISH" 
  | "CURRENT_AFFAIRS" 
  | "CULTURE" 
  | "SPORTS";

// 방 정보 인터페이스
export interface RoomResponse {
  id: string;
  title: string;
  difficulty?: "EASY" | "NORMAL" | "HARD";
  mainCategory?: string;
  subCategory?: string;
  currentPlayers?: number;
  capacity?: number;
  owner?: string;
  ownerId?: string | number;
  isPrivate?: boolean;
  password?: string;
  status?: "WAITING" | "PLAYING" | "FINISHED";
  createdAt?: string;
  updatedAt?: string;
  players?: PlayerProfile[];
}

// 플레이어 프로필 인터페이스
export interface PlayerProfile {
  id: string;
  nickname: string;
  profileImage?: string;
  ready: boolean;
  isOwner: boolean;
  status?: "WAITING" | "READY" | "PLAYING";
  score?: number;
}

// 방 메시지 타입
export type RoomMessageType = 
  | "JOIN"
  | "LEAVE"
  | "READY"
  | "UNREADY"
  | "START_GAME"
  | "ROOM_UPDATED"
  | "CHAT";

// 방 메시지 인터페이스
export interface RoomMessage {
  type: RoomMessageType;
  content?: string;
  data?: any;
  senderId?: string;
  senderName?: string;
  timestamp: number;
  roomId: string;
}

export interface JoinRoomRequest {
  playerId: string;
  password?: string;
}

export interface CreateRoomRequest {
  title: string;
  difficulty?: "EASY" | "NORMAL" | "HARD";
  mainCategory?: string;
  subCategory?: string;
  capacity?: number;
  isPrivate?: boolean;
  password?: string;
} 