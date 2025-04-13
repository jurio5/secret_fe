"use client";

import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

// SockJS 연결 옵션을 개선 - 전송 방식 순서 변경 및 타임아웃 증가
const socket = new SockJS(process.env.NEXT_PUBLIC_WAS_WS_HOST || "http://localhost:8080/ws", null, {
  transports: ['xhr-streaming', 'xhr-polling', 'websocket'], // websocket을 마지막 옵션으로 변경
  timeout: 20000 // 타임아웃 시간을 20초로 증가
});

let stompClientConnected = false;
// 구독 대기 큐 추가
const subscriptionQueue: {
  destination: string;
  callback: (message: any) => void;
}[] = [];
// 활성 구독 저장소 추가
const activeSubscriptions: { [key: string]: any } = {};

// 발행 대기 큐 추가
const publishQueue: {
  destination: string;
  body: any;
}[] = [];

// Java 객체 문자열 파싱 함수
const parseJavaObjectString = (text: string): any => {
  try {

    // 객체 이름과 내용 분리
    const match = text.match(/(\w+)\[(.*)\]/);
    if (!match) return null;
    
    const className = match[1]; // WebSocketChatMessageResponse
    const fieldsString = match[2];
    
    // 필드 파싱
    const result: Record<string, any> = { _className: className };
    let currentIdx = 0;
    let inQuote = false;
    let currentField = '';
    let currentKey = '';
    
    for (let i = 0; i < fieldsString.length; i++) {
      const char = fieldsString[i];
      
      if (char === '"' && fieldsString[i-1] !== '\\') {
        inQuote = !inQuote;
        currentField += char;
      } else if (char === '=' && !inQuote && !currentKey) {
        currentKey = currentField.trim();
        currentField = '';
      } else if (char === ',' && !inQuote) {
        // 필드 완료
        if (currentKey) {
          let value: any = currentField.trim();
          
          // 따옴표 제거
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } 
          // timestamp 필드만 숫자로 변환
          else if (currentKey === 'timestamp' && /^\d+$/.test(value)) {
            value = parseInt(value, 10);
          }
          
          result[currentKey] = value;
          currentKey = '';
          currentField = '';
        }
      } else {
        currentField += char;
      }
    }
    
    // 마지막 필드 처리
    if (currentKey) {
      let value: any = currentField.trim();
      
      // 따옴표 제거
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } 
      // timestamp 필드만 숫자로 변환
      else if (currentKey === 'timestamp' && /^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }
      
      result[currentKey] = value;
    }
    
    return result;
  } catch (error) {
    console.error("Java 객체 문자열 파싱 실패:", error);
    return null;
  }
};

let stompClient = new Client({
  webSocketFactory: () => socket,
  connectHeaders: {},
  debug: (str) => {
    console.log("[STOMP]", str);
  },
  reconnectDelay: 5000,
  heartbeatIncoming: 25000,
  heartbeatOutgoing: 25000,
  onConnect: () => {
    console.log("✅ WebSocket 연결 성공");
    stompClientConnected = true;

    // 연결 성공 시 대기 중인 구독 처리
    while (subscriptionQueue.length > 0) {
      const { destination, callback } = subscriptionQueue.shift()!;
      performSubscribe(destination, callback);
    }

    // 연결 성공 시 대기 중인 발행 처리
    while (publishQueue.length > 0) {
      const { destination, body } = publishQueue.shift()!;
      performPublish(destination, body);
    }
  },
  onStompError: (frame) => {
    console.error("❌ STOMP 오류:", frame.headers["message"]);
    console.error("상세 내용:", frame.body);
  },
});

// 실제 구독을 수행하는 내부 함수
const performSubscribe = (
  destination: string,
  callback: (message: any) => void
) => {
  const subscription = stompClient.subscribe(destination, (message) => {
    try {
      // JSON 파싱 시도
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message.body);
      } catch (jsonError) {
        console.warn(`JSON 파싱 실패 (${destination}):`, jsonError);
        console.debug("원본 메시지:", message.body);
        
        // Java 객체 문자열 파싱 시도
        if (message.body.includes("WebSocketChatMessageResponse[")) {
          const javaObject = parseJavaObjectString(message.body);
          if (javaObject) {
            console.debug("Java 객체 문자열 파싱 성공:", javaObject);
            callback(javaObject);
            return;
          }
        }
        
        // 특정 패턴 메시지 처리 (ROOM_CREATED 등)
        if (destination === "/topic/lobby" && message.body.startsWith("ROOM_CREATED:")) {
          const roomId = message.body.split(":")[1];
          console.debug("방 생성 메시지 감지:", roomId);
          callback({
            type: "ROOM_CREATED",
            roomId: parseInt(roomId),
            timestamp: Date.now()
          });
          return;
        }
        
        // 채팅 메시지 관련 처리 (/topic/room/chat/ 등)
        if (destination.includes('/chat/') || destination.includes('/room/chat/') || destination.includes('/game/chat/')) {
          console.log("🔰 채팅 메시지 감지:", {
            destination,
            rawMessage: message.body,
            timestamp: new Date().toISOString()
          });
          
          let content = message.body;
          let type = "CHAT";
          let roomId = destination.split('/').pop() || "unknown";
          
          // 메시지가 따옴표로 감싸진 경우 제거
          if (content.startsWith('"') && content.endsWith('"')) {
            try {
              content = content.slice(1, -1);
              console.log("따옴표 제거된 내용:", content);
            } catch (e) {
              console.warn("따옴표 제거 실패:", e);
            }
          }
          
          // 메시지가 이스케이프된 경우 정상화
          if (content.includes('\\')) {
            try {
              content = JSON.parse(`"${content}"`);
              console.log("이스케이프 처리된 내용:", content);
            } catch (e) {
              console.warn("이스케이프 문자열 처리 실패:", e);
            }
          }
          
          console.log("📨 처리된 채팅 메시지:", {
            content,
            roomId,
            timestamp: new Date().toISOString()
          });
          
          // 채팅 메시지용 기본 객체 생성
          callback({
            type,
            content,
            senderId: "system",
            senderName: "서버",
            timestamp: Date.now(),
            roomId
          });
          return;
        }
        
        // 기타 메시지는 원본 반환
        callback(message.body);
        return;
      }
      
      // JSON 파싱 성공 케이스
      callback(parsedMessage);
    } catch (error) {
      console.error("메시지 파싱 실패:", error);
      console.debug("원본 메시지:", message.body);
      
      // 채팅 메시지 특수 처리 (/topic/lobby/chat 등)
      if (destination.includes('/chat')) {
        // 채팅 메시지용 기본 객체 생성
        callback({
          type: "CHAT",
          content: message.body,
          senderId: "system",
          senderName: "System",
          timestamp: Date.now(),
          roomId: destination.split('/').pop() || "unknown"
        });
      } else {
        // 기타 메시지는 원본 반환
        callback(message.body);
      }
    }
  });
  activeSubscriptions[destination] = subscription;
};

// 구독 함수
const subscribe = (destination: string, callback: (message: any) => void) => {
  if (!stompClientConnected) {
    // 연결되지 않은 경우 큐에 추가
    subscriptionQueue.push({ destination, callback });
  } else {
    // 이미 연결된 경우 바로 구독
    performSubscribe(destination, callback);
  }
};

// 구독 해제 함수
const unsubscribe = (destination: string) => {
  if (activeSubscriptions[destination]) {
    activeSubscriptions[destination].unsubscribe();
    delete activeSubscriptions[destination];
  }
};

// 실제 발행을 수행하는 내부 함수
const performPublish = (destination: string, body: any) => {
  stompClient.publish({
    destination,
    body: JSON.stringify(body),
  });
};

// 발행 함수
const publish = (destination: string, body: any) => {
  if (!stompClientConnected) {
    // 연결되지 않은 경우 큐에 추가
    publishQueue.push({ destination, body });
  } else {
    // 이미 연결된 경우 바로 발행
    performPublish(destination, body);
  }
};

// 웹소켓 연결을 완전히 재설정하는 함수
const reconnectWebSocket = () => {
  try {
    console.log("웹소켓 연결 재설정 시작");
    
    // 모든 구독 해제
    Object.keys(activeSubscriptions).forEach(destination => {
      if (activeSubscriptions[destination]) {
        activeSubscriptions[destination].unsubscribe();
        delete activeSubscriptions[destination];
      }
    });
    
    // 기존 클라이언트 비활성화
    if (stompClientConnected) {
      stompClient.deactivate();
      stompClientConnected = false;
    }
    
    // 새로운 소켓 연결 생성 - 개선된 설정 적용
    const newSocket = new SockJS(process.env.NEXT_PUBLIC_WAS_WS_HOST || "http://localhost:8080/ws", null, {
      transports: ['xhr-streaming', 'xhr-polling', 'websocket'], // websocket을 마지막 옵션으로 변경
      timeout: 20000 // 타임아웃 시간을 20초로 증가
    });
    
    // 새 STOMP 클라이언트 생성
    stompClient = new Client({
      webSocketFactory: () => newSocket,
      connectHeaders: {},
      debug: (str) => {
        console.log("[STOMP]", str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 25000,
      heartbeatOutgoing: 25000,
      onConnect: () => {
        console.log("✅ 웹소켓 재연결 성공");
        stompClientConnected = true;
        
        // 연결 성공 시 대기 중인 구독 처리
        while (subscriptionQueue.length > 0) {
          const { destination, callback } = subscriptionQueue.shift()!;
          performSubscribe(destination, callback);
        }
    
        // 연결 성공 시 대기 중인 발행 처리
        while (publishQueue.length > 0) {
          const { destination, body } = publishQueue.shift()!;
          performPublish(destination, body);
        }
      }
    });
    
    stompClient.activate();
    
    return true;
  } catch (error) {
    console.error("웹소켓 재연결 실패:", error);
    return false;
  }
};

stompClient.activate();

export default stompClient;
export { subscribe, unsubscribe, publish, reconnectWebSocket };