"use client";

import SockJS from "sockjs-client";
import { Client, IMessage, StompSubscription } from "@stomp/stompjs";

const isBrowser = typeof window !== "undefined";

let socket: any = null;
let stompClient: Client | null = null;
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

let connectionStatus = 'DISCONNECTED'; // 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'RECONNECTING'
const reconnectDelay = 8000;
const maxReconnectAttempts = 10;
let reconnectAttempts = 0;
let connectionErrorCallback: ((error: Error) => void) | null = null;


function getCookie(name: string): string | null {
  if (!isBrowser) return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

const getAccessToken = (): string | null => {
  if (!isBrowser) return null;
  
  const cookieToken = getCookie('access_token');
  if (cookieToken) {
    console.log('쿠키에서 토큰 찾음');
    return cookieToken;
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('access_token');
  if (urlToken) {
    console.log('URL에서 토큰 찾음');
    localStorage.setItem('access_token', urlToken);
    return urlToken;
  }
  
  const localStorageToken = localStorage.getItem('access_token');
  if (localStorageToken) {
    console.log('로컬스토리지에서 토큰 찾음');
    return localStorageToken;
  }
  
  console.warn('토큰을 어디에서도 찾을 수 없음');
  return null;
};

const getWebSocketUrl = () => {
  if (!isBrowser) return '';
  
  const wsHost = process.env.NEXT_PUBLIC_WAS_WS_HOST;
  const baseUrl = wsHost || (process.env.NEXT_PUBLIC_WAS_HOST || 'http://localhost:8080') + '/ws';
  
  const accessToken = getAccessToken();
  const url = accessToken 
    ? `${baseUrl}?access_token=${encodeURIComponent(accessToken)}` 
    : baseUrl;
  
  console.debug('WebSocket URL 생성:', url);
  return url;
};


const createStompClient = () => {
  if (!isBrowser) return null;
  
  try {
    socket = new SockJS(getWebSocketUrl());
    console.log('새 SockJS 소켓 생성:', getWebSocketUrl());
    
    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {},
      debug: (str) => {
        console.log("[STOMP]", str);
      },
      reconnectDelay,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    client.onConnect = function () {
      console.log('STOMP 연결 성공');
      stompClientConnected = true;
      connectionStatus = 'CONNECTED';
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

    client.onWebSocketClose = function (evt) {
      console.log('STOMP 웹소켓 연결 종료:', evt);
      stompClientConnected = false;
      connectionStatus = 'RECONNECTING';
      
      console.log(`재연결 시도 중... (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
      reconnectAttempts++;
      
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('최대 재연결 시도 횟수 초과. 연결 실패.');
        connectionStatus = 'DISCONNECTED';
        client.deactivate();
        
        // 오류 콜백이 있으면 호출
        if (connectionErrorCallback) {
          connectionErrorCallback(new Error("최대 재연결 시도 횟수를 초과했습니다."));
        }
      }
    };

    client.onStompError = function (frame) {
      console.error('❌ STOMP 오류:', frame.headers['message']);
      console.error('추가 정보:', frame.body);
      
      // 오류 콜백이 있으면 호출
      if (connectionErrorCallback) {
        connectionErrorCallback(new Error(`STOMP 오류: ${frame.headers['message']}`));
      }
    };
    
    return client;
  } catch (error) {
    console.error('STOMP 클라이언트 생성 중 오류:', error);
    connectionStatus = 'DISCONNECTED';
    
    // 오류 콜백이 있으면 호출
    if (connectionErrorCallback && error instanceof Error) {
      connectionErrorCallback(error);
    }
    
    return null;
  }
};

/**
 * 웹소켓 연결을 초기화하고 시작하는 함수
 */
const connect = () => {
  if (!isBrowser || stompClientConnected) return;
  
  console.log('STOMP 연결 시작...');
  connectionStatus = 'CONNECTING';
  
  try {
    // 기존 클라이언트가 있으면 정리
    if (stompClient) {
      try {
        stompClient.deactivate();
      } catch (e) {
        console.warn('기존 STOMP 클라이언트 정리 중 오류:', e);
      }
    }
    
    // 새 클라이언트 생성
    stompClient = createStompClient();
    
    if (stompClient) {
      // 연결 활성화
      stompClient.activate();
      return true;
    } else {
      connectionStatus = 'DISCONNECTED';
      return false;
    }
  } catch (error) {
    console.error('STOMP 연결 시작 중 오류:', error);
    connectionStatus = 'DISCONNECTED';
    
    // 오류 콜백이 있으면 호출
    if (connectionErrorCallback && error instanceof Error) {
      connectionErrorCallback(error);
    }
    
    return false;
  }
};

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
  if (!isBrowser || !stompClientConnected || !stompClient) return null;
  
  try {
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
  } catch (error) {
    console.error(`'${destination}' 구독 중 오류:`, error);
    return null;
  }
};

const subscribe = (destination: string, callback: (message: any) => void) => {
  if (!isBrowser) return;
  
  subscriptionCallbacks[destination] = callback;
  
  // 연결되지 않았으면 자동으로 연결 시도
  if (!stompClientConnected) {
    console.log(`'${destination}'에 구독 예약 (연결 대기 중)`);
    
    // 연결되지 않았으면 연결 시도
    if (connectionStatus === 'DISCONNECTED') {
      connect();
    }
    
    return;
  }
  
  return performSubscribe(destination, callback);
};

const unsubscribe = (destination: string) => {
  if (!isBrowser) return;
  
  try {
    if (activeSubscriptions[destination]) {
      activeSubscriptions[destination].unsubscribe();
      delete activeSubscriptions[destination];
      delete subscriptionCallbacks[destination];
    }
  } catch (error) {
    console.error(`'${destination}' 구독 해제 중 오류:`, error);
  }
};

const performPublish = (
  destination: string,
  body: any
) => {
  if (!isBrowser || !stompClient) return;
  
  try {
    stompClient.publish({
      destination,
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(`'${destination}'에 메시지 전송 중 오류:`, error);
  }
};

const publish = (destination: string, body: any) => {
  if (!isBrowser) return;
  
  if (!stompClientConnected) {
    publishQueue.push({ destination, body });
    
    // 연결되지 않았으면 연결 시도
    if (connectionStatus === 'DISCONNECTED') {
      connect();
    }
  } else {
    performPublish(destination, body);
  }
};

const isConnected = () => {
  return stompClientConnected;
};

const waitForConnection = (timeout = 30000): Promise<void> => {
  if (!isBrowser) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    if (stompClientConnected) {
      return resolve();
    }
    
    // 아직 연결 시도를 하지 않았으면 연결 시도
    if (connectionStatus === 'DISCONNECTED') {
      connect();
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

const disconnect = (): Promise<void> => {
  if (!isBrowser) return Promise.resolve();
  
  return new Promise((resolve) => {
    if (!stompClientConnected || !stompClient) {
      connectionStatus = 'DISCONNECTED';
      stompClientConnected = false;
      return resolve();
    }
    
    console.log('STOMP 연결 종료 중...');
    
    try {
      // 모든 활성 구독 해제
      Object.keys(activeSubscriptions).forEach(unsubscribe);
      
      // 클라이언트 비활성화
      stompClient.deactivate();
      stompClientConnected = false;
      connectionStatus = 'DISCONNECTED';
      
      // 소켓 정리
      if (socket) {
        try {
          socket.close();
        } catch (e) {
          console.warn('소켓 정리 중 오류:', e);
        }
        socket = null;
      }
      
      // 클라이언트 정리
      stompClient = null;
      
      console.log('STOMP 연결 종료됨');
    } catch (error) {
      console.error('STOMP 연결 종료 중 오류:', error);
      connectionStatus = 'DISCONNECTED';
      stompClientConnected = false;
    }
    
    resolve();
  });
};

const getConnectionStatus = (): string => {
  return connectionStatus;
};

/**
 * 연결 오류 발생 시 호출될 콜백 함수 설정
 */
const setConnectionErrorCallback = (callback: (error: Error) => void) => {
  connectionErrorCallback = callback;
};

// 초기 연결은 자동으로 하지 않고, 필요할 때 connect() 함수를 호출하도록 변경

export default {
  connect,
  disconnect,
  subscribe,
  unsubscribe,
  publish,
  isConnected,
  waitForConnection,
  getConnectionStatus,
  setConnectionErrorCallback
};

export {
  connect,
  disconnect,
  subscribe,
  unsubscribe,
  publish,
  isConnected,
  waitForConnection,
  getConnectionStatus,
  setConnectionErrorCallback
};