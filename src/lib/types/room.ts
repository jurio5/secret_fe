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
  id?: number;
  title?: string;
  status?: RoomStatus;
  ownerId?: number;
  ownerNickname?: string;
  currentPlayers?: number;
  capacity?: number;
  difficulty?: Difficulty;
  mainCategory?: MainCategory;
  subCategory?: SubCategory;
  problemCount?: number;
  isPrivate?: boolean;
  password?: string;
  players?: number[];
  readyPlayers?: number[];
  createdAt?: string;
}

// 플레이어 프로필 인터페이스
export interface PlayerProfile {
  id: string;
  nickname: string;
  avatarUrl?: string;
  isOwner: boolean;
  isReady: boolean;
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