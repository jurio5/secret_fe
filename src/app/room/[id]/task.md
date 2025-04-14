1. 게임방에들어오면
    1. 방에대한정보,내정보를가져오기
    2. Room에 조인하기
        1. RestAPI Join처리
            1. 새로고침으로들어올경우 - > 기존에 이미join되어있음
            2. 없을경우엔 join해야됨
        2. WebSocket Join처리
            1. 웹소켓 Join 구독
            2. 웹소켓 Status 구독
            3. 웹소켓 Join 전파
    2. 접속유저목록불러오기
    