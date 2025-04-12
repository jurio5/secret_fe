"use client";

import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const socket = new SockJS(process.env.NEXT_PUBLIC_WAS_WS_HOST!!);

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

let stompClient = new Client({
  webSocketFactory: () => socket,
  connectHeaders: {},
  debug: (str) => {
    console.log("[STOMP]", str);
  },
  reconnectDelay: 5000,
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
    callback(JSON.parse(message.body));
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
    
    // 새로운 소켓 연결 생성
    const newSocket = new SockJS(process.env.NEXT_PUBLIC_WAS_WS_HOST!!);
    
    // 새 STOMP 클라이언트 생성
    stompClient = new Client({
      webSocketFactory: () => newSocket,
      connectHeaders: {},
      debug: (str) => {
        console.log("[STOMP]", str);
      },
      reconnectDelay: 5000,
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
      },
      onStompError: (frame) => {
        console.error("❌ STOMP 오류:", frame.headers["message"]);
        console.error("상세 내용:", frame.body);
      },
    });
    
    // 새 클라이언트 활성화
    stompClient.activate();
    
    return true;
  } catch (error) {
    console.error("웹소켓 재연결 중 오류 발생:", error);
    return false;
  }
};

stompClient.activate();

export default stompClient;
export { subscribe, unsubscribe, publish, reconnectWebSocket };