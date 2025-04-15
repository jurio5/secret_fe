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
    //console.error("Java 객체 문자열 파싱 실패:", error);
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
    console.log("✅ WebSocket 연결 성공, 대기 중인 구독 및 발행 처리 시작");
    stompClientConnected = true;

    console.log(`대기 중인 구독 수: ${subscriptionQueue.length}, 발행 수: ${publishQueue.length}`);
    
    // 연결 성공 시 대기 중인 구독 처리
    while (subscriptionQueue.length > 0) {
      const { destination, callback } = subscriptionQueue.shift()!;
      console.log(`대기 큐에서 구독 처리: ${destination}`);
      performSubscribe(destination, callback);
    }

    // 연결 성공 시 대기 중인 발행 처리
    while (publishQueue.length > 0) {
      const { destination, body } = publishQueue.shift()!;
      console.log(`대기 큐에서 발행 처리: ${destination}`);
      performPublish(destination, body);
    }
    
    console.log("모든 대기 중인 작업 처리 완료");
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
  console.log(`[SUBSCRIBE] 구독 실행: ${destination}`);
  
  try {
    const subscription = stompClient.subscribe(destination, (message) => {
      console.log(`[MESSAGE] ${destination} 메시지 수신:`, 
        typeof message.body === 'string' 
          ? message.body.substring(0, 50) + (message.body.length > 50 ? '...' : '') 
          : '[비문자열]');
      
      // 채팅 메시지 특별 처리
      if (destination.includes('/chat/')) {
        console.log(`[CHAT] 채팅 메시지 감지: ${destination}`);
      }
      
      try {
        // JSON 파싱 시도 전에 문자열 확인 로직 추가
        if (typeof message.body === 'string') {
          // ROOM_DELETED: 형식 메시지 특수 처리
          if (message.body.startsWith("ROOM_DELETED:")) {
            const roomId = message.body.split(":")[1];
            console.log(`[MESSAGE] 방 삭제 메시지 감지: ${roomId}`);
            callback({
              type: "ROOM_DELETED",
              roomId: parseInt(roomId),
              timestamp: Date.now()
            });
            return;
          }
          
          // ROOM_UPDATED: 형식 메시지 특수 처리
          if (message.body.startsWith("ROOM_UPDATED:")) {
            const roomId = message.body.split(":")[1];
            console.log(`[MESSAGE] 방 업데이트 메시지 감지: ${roomId}`);
            callback({
              type: "ROOM_UPDATED",
              roomId: parseInt(roomId),
              timestamp: Date.now()
            });
            return;
          }
          
          // ROOM_CREATED: 형식 메시지 특수 처리
          if (message.body.startsWith("ROOM_CREATED:")) {
            const roomId = message.body.split(":")[1];
            console.log(`[MESSAGE] 방 생성 메시지 감지: ${roomId}`);
            callback({
              type: "ROOM_CREATED",
              roomId: parseInt(roomId),
              timestamp: Date.now()
            });
            return;
          }
        }
        
        // JSON 파싱 시도
        const parsedMessage = JSON.parse(message.body);
        console.log(`[MESSAGE] JSON 파싱 성공:`, 
          parsedMessage ? 
            `타입=${parsedMessage.type || 'no-type'}, ID=${parsedMessage.id || 'no-id'}` : 
            'empty');
        callback(parsedMessage);
      } catch (error) {
        console.log(`[MESSAGE] JSON 파싱 실패, 대체 처리 시도:`, error);
        
        // JSON 파싱 실패 시 Java 객체 문자열 파싱 시도
        if (typeof message.body === 'string' && message.body.includes("WebSocketChatMessageResponse[")) {
          const javaObject = parseJavaObjectString(message.body);
          if (javaObject) {
            //console.debug("Java 객체 문자열 파싱 성공:", javaObject);
            callback(javaObject);
            return;
          }
        }
        
        // 일반 문자열 메시지는 그대로 전달하기 전에 채팅 메시지인지 확인
        if (typeof message.body === 'string') {
          // 채팅 메시지 특수 처리
          if (destination.includes('/chat')) {
            try {
              // 문자열에서 중괄호 추출 시도
              const bracketMatch = message.body.match(/{.*}/);
              if (bracketMatch) {
                try {
                  const jsonContent = JSON.parse(bracketMatch[0]);
                  console.log("[MESSAGE] 중괄호에서 JSON 추출 성공");
                  callback(jsonContent);
                  return;
                } catch (e) {
                  console.log("[MESSAGE] 중괄호 내용 파싱 실패");
                }
              }
              
              // 채팅 메시지용 기본 객체 생성
              const roomId = destination.includes('/chat/') 
                ? destination.split('/chat/')[1] 
                : destination.split('/').pop() || "unknown";
              
              callback({
                type: "CHAT",
                content: message.body,
                senderId: "system",
                senderName: "System",
                timestamp: Date.now(),
                roomId: roomId
              });
              return;
            } catch (chatError) {
              console.error("[MESSAGE] 채팅 메시지 처리 중 오류:", chatError);
              callback({
                type: "SYSTEM",
                content: "메시지 처리 중 오류가 발생했습니다.",
                senderId: "system",
                senderName: "System",
                timestamp: Date.now()
              });
              return;
            }
          }
          
          // 채팅 메시지가 아닌 일반 문자열 메시지
          console.log(`[MESSAGE] 일반 문자열 메시지 직접 전달: ${message.body}`);
          callback(message.body);
          return;
        }
      }
    });
    
    console.log(`[SUBSCRIBE] 구독 완료: ${destination}`);
    activeSubscriptions[destination] = subscription;
  } catch (subscribeError) {
    console.error(`[SUBSCRIBE] 구독 실패: ${destination}`, subscribeError);
  }
};

// 구독 함수
const subscribe = (destination: string, callback: (message: any) => void) => {
  console.log(`[SUBSCRIBE] 구독 요청: ${destination}`);
  
  // 이미 구독되어 있는 경우 확인
  if (activeSubscriptions[destination]) {
    console.log(`[SUBSCRIBE] ❗ 이미 구독 중: ${destination}`);
    
    // 이미 존재하는 구독은 유지하고 콜백만 교체
    const oldSubscription = activeSubscriptions[destination];
    oldSubscription.unsubscribe();
    delete activeSubscriptions[destination];
    console.log(`[SUBSCRIBE] 기존 구독 해제 후 재구독: ${destination}`);
  }

  if (!stompClientConnected) {
    // 연결되지 않은 경우 큐에 추가
    console.log(`[SUBSCRIBE] 아직 연결되지 않음, 구독 큐에 추가: ${destination}`);
    subscriptionQueue.push({ destination, callback });
  } else {
    // 이미 연결된 경우 바로 구독
    console.log(`[SUBSCRIBE] 즉시 구독 처리: ${destination}`);
    performSubscribe(destination, callback);
  }
};

// 구독 해제 함수
const unsubscribe = (destination: string) => {
  if (activeSubscriptions[destination]) {
    console.log(`[UNSUBSCRIBE] 구독 해제: ${destination}`);
    try {
      activeSubscriptions[destination].unsubscribe();
      delete activeSubscriptions[destination];
    } catch (error) {
      console.error(`[UNSUBSCRIBE] 구독 해제 중 오류: ${destination}`, error);
    }
  } else {
    console.log(`[UNSUBSCRIBE] 구독 해제 요청했으나 활성 구독 없음: ${destination}`);
  }
};

// 실제 STOMP 메시지 발행 함수
const performPublish = async (destination: string, body: any) => {
  if (!stompClient || !isConnected) {
    console.error("STOMP 클라이언트가 연결되지 않았습니다.");
    return false;
  }

  try {
    // 채팅 메시지의 경우 문자열로 직접 전송
    const isChatMessage = destination === "/app/lobby/chat" || 
                         (destination.includes("/app/room/") && destination.includes("/chat"));
    
    if (isChatMessage && typeof body === 'string') {
      console.log(`[STOMP] 메시지 발행: ${destination}, 본문 타입(문자열): ${body}`);
      stompClient.publish({
        destination,
        body: body,  // 직접 문자열 전송
      });
    } else {
      console.log(`[STOMP] 메시지 발행: ${destination}, 본문 타입(객체): ${typeof body === 'object' ? JSON.stringify(body) : body}`);
      stompClient.publish({
        destination,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    }
    
    return true;
  } catch (error) {
    console.error(`[STOMP] 메시지 발행 오류: ${destination}`, error);
    return false;
  }
};

// 발행 함수
const publish = (destination: string, body: any) => {
  if (!stompClientConnected) {
    // 연결되지 않은 경우 큐에 추가
    console.log(`[PUBLISH] 연결 안됨, 발행 큐에 추가: ${destination}`);
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

// 웹소켓 연결 상태 확인 함수
const isConnected = () => {
  // 단순히 플래그만 확인하는 것이 아니라 실제 STOMP 클라이언트의 상태까지 확인
  const connected = stompClientConnected && !!stompClient.connected;
  console.log(`[CONNECTION] WebSocket 연결 상태 확인: ${connected ? '연결됨' : '연결안됨'}`);
  return connected;
};

// 연결 상태를 비동기적으로 확인하고 대기하는 함수 추가
export const waitForConnection = async (timeout = 5000): Promise<boolean> => {
  console.log(`[CONNECTION] 연결 완료 대기 시작 (최대 ${timeout}ms)`);
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (stompClient.connected) {
      console.log(`[CONNECTION] 연결 완료됨 (${Date.now() - startTime}ms 소요)`);
      stompClientConnected = true;
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`[CONNECTION] 연결 대기 시간 초과 (${timeout}ms)`);
  return false;
};

// 안전한 구독 함수 - 연결 확인 및 중복 구독 방지
export const safeSubscribe = async (
  destination: string, 
  callback: (message: any) => void
): Promise<boolean> => {
  console.log(`[SAFE-SUBSCRIBE] ${destination} 안전 구독 시도`);
  
  // 이미 구독 중인지 확인
  if (activeSubscriptions[destination]) {
    console.log(`[SAFE-SUBSCRIBE] ${destination}에 대한 기존 구독 발견, 재사용`);
    return true;
  }
  
  // 연결 상태 확인
  if (!stompClient.connected) {
    console.log(`[SAFE-SUBSCRIBE] 연결되지 않음, 대기 시작`);
    
    // 연결될 때까지 대기 (최대 3초)
    const connectionSuccess = await waitForConnection(3000);
    
    // 여전히 연결되지 않았다면 재연결 시도
    if (!connectionSuccess) {
      console.log(`[SAFE-SUBSCRIBE] 연결 대기 시간 초과, 재연결 시도`);
      const reconnectSuccess = await reconnectWebSocket();
      
      if (!reconnectSuccess) {
        console.log(`[SAFE-SUBSCRIBE] 재연결 실패, 구독 불가: ${destination}`);
        return false;
      }
      
      // 재연결 후 추가 대기
      await waitForConnection(2000);
    }
  }
  
  // 여기까지 왔다면 연결된 상태여야 함
  if (!stompClient.connected) {
    console.log(`[SAFE-SUBSCRIBE] 모든 시도 후에도 연결 실패, 구독 불가: ${destination}`);
    return false;
  }
  
  // 연결됐을 때 구독 시도
  try {
    const subscription = stompClient.subscribe(destination, (message) => {
      console.log(`[SAFE-MESSAGE] ${destination} 메시지 수신:`, 
        typeof message.body === 'string' 
          ? message.body.substring(0, 30) + (message.body.length > 30 ? '...' : '') 
          : '[비문자열]');
      
      // JSON 파싱 시도 전에 문자열 확인 로직 추가
      if (typeof message.body === 'string') {
        // ROOM_DELETED: 형식 메시지 특수 처리
        if (message.body.startsWith("ROOM_DELETED:")) {
          const roomId = message.body.split(":")[1];
          console.log(`[SAFE-MESSAGE] 방 삭제 메시지 감지: ${roomId}`);
          callback({
            type: "ROOM_DELETED",
            roomId: parseInt(roomId),
            timestamp: Date.now()
          });
          return;
        }
        
        // ROOM_UPDATED: 형식 메시지 특수 처리
        if (message.body.startsWith("ROOM_UPDATED:")) {
          const roomId = message.body.split(":")[1];
          console.log(`[SAFE-MESSAGE] 방 업데이트 메시지 감지: ${roomId}`);
          callback({
            type: "ROOM_UPDATED",
            roomId: parseInt(roomId),
            timestamp: Date.now()
          });
          return;
        }
        
        // ROOM_CREATED: 형식 메시지 특수 처리
        if (message.body.startsWith("ROOM_CREATED:")) {
          const roomId = message.body.split(":")[1];
          console.log(`[SAFE-MESSAGE] 방 생성 메시지 감지: ${roomId}`);
          callback({
            type: "ROOM_CREATED",
            roomId: parseInt(roomId),
            timestamp: Date.now()
          });
          return;
        }
      }
      
      try {
        // JSON 파싱 시도
        const parsedMessage = JSON.parse(message.body);
        
        // 채팅 메시지인 경우 따옴표 처리
        if (destination.includes('/chat') && parsedMessage && parsedMessage.content) {
          if (typeof parsedMessage.content === 'string' && 
              parsedMessage.content.startsWith('"') && 
              parsedMessage.content.endsWith('"')) {
            parsedMessage.content = parsedMessage.content.substring(1, parsedMessage.content.length - 1);
            console.log('[CHAT] 메시지 따옴표 제거:', parsedMessage.content);
          }
        }
        
        callback(parsedMessage);
      } catch (error) {
        // JSON 파싱 실패 시 기존 처리 로직 활용
        if (message.body.includes("WebSocketChatMessageResponse[")) {
          const javaObject = parseJavaObjectString(message.body);
          if (javaObject) {
            // 채팅 메시지인 경우 따옴표 처리 추가
            if (javaObject.content && typeof javaObject.content === 'string') {
              if (javaObject.content.startsWith('"') && javaObject.content.endsWith('"')) {
                javaObject.content = javaObject.content.substring(1, javaObject.content.length - 1);
                console.log('[CHAT] Java 객체 메시지 따옴표 제거:', javaObject.content);
              }
            }
            callback(javaObject);
            return;
          }
        }
        
        // 다른 특수 메시지 처리
        if (destination === "/topic/lobby" && message.body.startsWith("ROOM_CREATED:")) {
          const roomId = message.body.split(":")[1];
          callback({
            type: "ROOM_CREATED",
            roomId: parseInt(roomId),
            timestamp: Date.now()
          });
          return;
        }
        
        // 채팅 메시지 특수 처리
        if (destination.includes('/chat')) {
          try {
            const roomId = destination.includes('/chat/') 
              ? destination.split('/chat/')[1] 
              : destination.split('/').pop() || "unknown";
            
            // 따옴표 제거 처리 추가
            let content = message.body;
            if (typeof content === 'string' && content.startsWith('"') && content.endsWith('"')) {
              content = content.substring(1, content.length - 1);
              console.log('[CHAT] 원본 메시지 따옴표 제거:', content);
            }
            
            callback({
              type: "CHAT",
              content: content,
              senderId: "system",
              senderName: "System",
              timestamp: Date.now(),
              roomId: roomId
            });
          } catch (chatError) {
            callback({
              type: "SYSTEM",
              content: "메시지 처리 중 오류가 발생했습니다.",
              senderId: "system",
              senderName: "System",
              timestamp: Date.now()
            });
          }
        } else {
          callback(message.body);
        }
      }
    });
    
    console.log(`[SAFE-SUBSCRIBE] ${destination} 구독 성공`);
    activeSubscriptions[destination] = subscription;
    return true;
  } catch (error) {
    console.error(`[SAFE-SUBSCRIBE] ${destination} 구독 중 오류 발생:`, error);
    return false;
  }
};

// 안전한 발행 함수 - 연결 확인 및 대기 후 발행
export const safePublish = async (destination: string, body: any): Promise<boolean> => {
  console.log(`[SAFE-PUBLISH] ${destination} 안전 발행 시도`);
  
  // 연결 상태 확인
  if (!stompClient.connected) {
    console.log(`[SAFE-PUBLISH] 연결되지 않음, 대기 시작`);
    
    // 연결될 때까지 대기 (최대 3초)
    const connectionSuccess = await waitForConnection(3000);
    
    // 여전히 연결되지 않았다면 재연결 시도
    if (!connectionSuccess) {
      console.log(`[SAFE-PUBLISH] 연결 대기 시간 초과, 재연결 시도`);
      const reconnectSuccess = await reconnectWebSocket();
      
      if (!reconnectSuccess) {
        console.log(`[SAFE-PUBLISH] 재연결 실패, 발행 불가: ${destination}`);
        return false;
      }
      
      // 재연결 후 추가 대기
      await waitForConnection(2000);
    }
  }
  
  // 여기까지 왔다면 연결된 상태여야 함
  if (!stompClient.connected) {
    console.log(`[SAFE-PUBLISH] 모든 시도 후에도 연결 실패, 발행 불가: ${destination}`);
    return false;
  }
  
  // 연결됐을 때 발행 시도
  try {
    // 채팅 메시지 처리를 특별히 처리 - 채팅의 경우 문자열 그대로 전송
    if (destination === "/app/lobby/chat" || destination.includes("/app/room/") && destination.includes("/chat")) {
      // 채팅 메시지는 이미 문자열이므로 직접 전송
      console.log(`[SAFE-PUBLISH] 채팅 메시지 직접 전송: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
      stompClient.publish({
        destination,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    } else {
      // 일반 메시지는 JSON으로 변환하여 전송
      console.log(`[SAFE-PUBLISH] 일반 메시지 JSON 변환 후 전송`);
      stompClient.publish({
        destination,
        body: JSON.stringify(body),
      });
    }
    
    console.log(`[SAFE-PUBLISH] ${destination} 발행 성공`);
    return true;
  } catch (error) {
    console.error(`[SAFE-PUBLISH] ${destination} 발행 중 오류 발생:`, error);
    return false;
  }
};

// 웹소켓 활성화 시 연결 성공 확인 추가
let activatePromise: Promise<boolean> | null = null;

// 활성화 함수 개선
export const activateAndWait = async (timeout = 5000): Promise<boolean> => {
  if (activatePromise) {
    return activatePromise;
  }
  
  activatePromise = new Promise<boolean>(async (resolve) => {
    console.log("[ACTIVATE] STOMP 클라이언트 활성화 및 연결 대기 시작");
    stompClient.activate();
    
    const connected = await waitForConnection(timeout);
    resolve(connected);
    
    // 완료 후 Promise 초기화
    setTimeout(() => {
      activatePromise = null;
    }, 100);
  });
  
  return activatePromise;
};

// 기존 클라이언트 활성화 코드를 Promise 기반으로 변경
console.log("STOMP 클라이언트 활성화 시작");
activateAndWait(10000).then(success => {
  console.log(`STOMP 클라이언트 초기화 ${success ? '성공' : '실패'}`);
});

export { subscribe, unsubscribe, publish, reconnectWebSocket, isConnected, stompClient };