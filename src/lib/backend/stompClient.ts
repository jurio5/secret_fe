"use client";

import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

// 클라이언트 사이드에서만 실행될 변수와 함수들
let socket: any;
let stompClient: any;
let stompClientConnected = false;
const subscriptionQueue: {
  destination: string;
  callback: (message: any) => void;
}[] = [];
const activeSubscriptions: { [key: string]: any } = {};
const publishQueue: {
  destination: string;
  body: any;
}[] = [];

// 브라우저 환경인지 확인
const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  // 클라이언트 사이드에서만 실행될 코드
  const getWebSocketUrl = () => {
    const wsHost = process.env.NEXT_PUBLIC_WAS_WS_HOST;
    
    if (!wsHost) {
      console.debug('NEXT_PUBLIC_WAS_WS_HOST가 설정되지 않았습니다. 기본값을 사용합니다.');
      const wasHost = process.env.NEXT_PUBLIC_WAS_HOST || 'http://localhost:8080';
      return `${wasHost}/ws`;
    }
    
    return wsHost;
  };

  // SockJS 인스턴스 생성
  socket = new SockJS(getWebSocketUrl());

  // STOMP 클라이언트 설정
  stompClient = new Client({
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

  // STOMP 클라이언트 활성화
  stompClient.activate();
}

// 실제 구독을 수행하는 내부 함수
const performSubscribe = (
  destination: string,
  callback: (message: any) => void
) => {
  if (!isBrowser) return;
  
  const subscription = stompClient.subscribe(destination, (message: any) => {
    callback(JSON.parse(message.body));
  });
  activeSubscriptions[destination] = subscription;
};

// 구독 함수
const subscribe = (destination: string, callback: (message: any) => void) => {
  if (!isBrowser) return;
  
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
  if (!isBrowser) return;
  
  if (activeSubscriptions[destination]) {
    activeSubscriptions[destination].unsubscribe();
    delete activeSubscriptions[destination];
  }
};

// 실제 발행을 수행하는 내부 함수
const performPublish = (
  destination: string,
  body: any
) => {
  if (!isBrowser) return;
  
  stompClient.publish({
    destination,
    body: JSON.stringify(body),
  });
};

// 발행 함수
const publish = (destination: string, body: any) => {
  if (!isBrowser) return;
  
  if (!stompClientConnected) {
    // 연결되지 않은 경우 큐에 추가
    publishQueue.push({ destination, body });
  } else {
    // 이미 연결된 경우 바로 발행
    performPublish(destination, body);
  }
};

// 연결 상태 확인 함수
const isConnected = () => {
  return stompClientConnected;
};

// 연결 대기 함수
const waitForConnection = (timeout = 5000): Promise<void> => {
  if (!isBrowser) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    // 이미 연결된 경우
    if (stompClientConnected) {
      return resolve();
    }
    
    // 타임아웃 설정
    const timeoutId = setTimeout(() => {
      reject(new Error("웹소켓 연결 타임아웃"));
    }, timeout);
    
    // 연결 확인 인터벌
    const checkInterval = 100;
    const intervalId = setInterval(() => {
      if (stompClientConnected) {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        resolve();
      }
    }, checkInterval);
  });
};

export default stompClient;
export { subscribe, unsubscribe, publish, isConnected, waitForConnection };
