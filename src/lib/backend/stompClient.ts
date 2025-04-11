"use client";

import SockJS from "sockjs-client";
import { Client, IMessage, StompSubscription } from "@stomp/stompjs";

const isBrowser = typeof window !== "undefined";

let socket: any;
let stompClient: Client = new Client();
let stompClientConnected = false;
let wasConnected = false;
const subscriptionQueue: {
  destination: string;
  callback: (message: any) => void;
}[] = [];
const activeSubscriptions: { [key: string]: StompSubscription } = {};
const publishQueue: {
  destination: string;
  body: any;
}[] = [];
const subscriptionCallbacks: { [key: string]: (message: any) => void } = {};

const reconnectDelay = 5000;
const maxReconnectAttempts = 10;
let reconnectAttempts = 0;

if (isBrowser) {
  const getWebSocketUrl = () => {
    const wsHost = process.env.NEXT_PUBLIC_WAS_WS_HOST;
     
    if (!wsHost) {
      console.debug('NEXT_PUBLIC_WAS_WS_HOST가 설정되지 않았습니다. 기본값을 사용합니다.');
      const wasHost = process.env.NEXT_PUBLIC_WAS_HOST || 'http://localhost:8080';
      return `${wasHost}/ws`;
    }
     
    return wsHost;
  };

  socket = new SockJS(getWebSocketUrl());

  stompClient = new Client({
    webSocketFactory: () => socket,
    connectHeaders: {},
    debug: (str) => {
      console.log("[STOMP]", str);
    },
    reconnectDelay,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000
  });

  stompClient.onConnect = function () {
    console.log('STOMP 연결 성공');
    stompClientConnected = true;
    reconnectAttempts = 0;

    if (wasConnected) {
      restoreSubscriptions();
    }
    
    while (publishQueue.length > 0) {
      const { destination, body } = publishQueue.shift()!;
      performPublish(destination, body);
    }
    
    wasConnected = true;
  };

  stompClient.onWebSocketClose = function (evt) {
    console.log('STOMP 웹소켓 연결 종료:', evt);
    stompClientConnected = false;
    
    console.log(`재연결 시도 중... (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
    reconnectAttempts++;
    
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('최대 재연결 시도 횟수 초과. 연결 실패.');
      stompClient.deactivate();
    }
  };

  stompClient.onStompError = function (frame) {
    console.error('❌ STOMP 오류:', frame.headers['message']);
    console.error('추가 정보:', frame.body);
  };

  stompClient.activate();
}

const restoreSubscriptions = () => {
  if (!isBrowser || !stompClientConnected) return;
  
  console.log('이전 구독 복원 중...');
  
  Object.keys(subscriptionCallbacks).forEach((destination) => {
    const callback = subscriptionCallbacks[destination];
    performSubscribe(destination, callback);
  });
  
  console.log('구독 복원 완료');
};

const performSubscribe = (
  destination: string,
  callback: (message: any) => void
) => {
  if (!isBrowser || !stompClientConnected) return null;
  
  const subscription = stompClient.subscribe(destination, (message: IMessage) => {
    try {
      const parsedBody = JSON.parse(message.body);
      callback(parsedBody);
    } catch (e) {
      callback(message.body);
    }
  });
  
  activeSubscriptions[destination] = subscription;
  return subscription;
};

const subscribe = (destination: string, callback: (message: any) => void) => {
  if (!isBrowser) return;
  
  subscriptionCallbacks[destination] = callback;
  
  if (!stompClientConnected) {
    console.log(`'${destination}'에 구독 예약 (연결 대기 중)`);
    return;
  }
  
  return performSubscribe(destination, callback);
};

const unsubscribe = (destination: string) => {
  if (!isBrowser) return;
  
  if (activeSubscriptions[destination]) {
    activeSubscriptions[destination].unsubscribe();
    delete activeSubscriptions[destination];
    delete subscriptionCallbacks[destination];
  }
};

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

const publish = (destination: string, body: any) => {
  if (!isBrowser) return;
  
  if (!stompClientConnected) {
    publishQueue.push({ destination, body });
  } else {
    performPublish(destination, body);
  }
};

const isConnected = () => {
  return stompClientConnected;
};

const waitForConnection = (timeout = 5000): Promise<void> => {
  if (!isBrowser) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    if (stompClientConnected) {
      return resolve();
    }
    
    const timeoutId = setTimeout(() => {
      reject(new Error("웹소켓 연결 타임아웃"));
    }, timeout);
    
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
