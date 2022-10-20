// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from './app.module.css';
import { useState, useRef, useEffect, memo } from 'react';
import {
  Text,
  useToast
} from '@chakra-ui/react';
import { WebRTCClient } from '@webrtc-video-demo/webrtc-sdk';
import RoomJoin from '../components/RoomJoin';

export function App() {
  const toast = useToast();
  const [room, setRoom] = useState('');
  const [SDK, setSDK] = useState<WebRTCClient>();
  const videoEl = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoEl) {
      setSDK(new WebRTCClient({
        // localElement: videoEl.current as HTMLVideoElement,
        remoteElement: videoEl.current as HTMLVideoElement,
        events: {
          onJoined: () => {
            console.log('joined');
          },
          onLeaved: () => { },
          onCustomerJoined: (room, id) => {
            console.log(`客户已加入房间${room} 房间id: ${id}`);
          },
          onFull: (room, id) => { },
          onBye: () => { },
          onDisconnect: () => { },
        }
      }));
    }
  }, [videoEl]);

  const onRoomChange = (room: string) => {
    setRoom(room);
  }

  const onJoinRoom = () => {
    if (room && SDK) {
      SDK.join(room);
    } else {
      toast({
        title: 'Room ID cannot be empty',
        status: 'error',
        isClosable: true
      });
    }
  }

  return (
    <div className={styles['wrapper']}>
      <Text fontSize='5xl'>YCD Video Live System Demo - Video-End</Text>
      <div className={styles['video-section']}>
        <video autoPlay playsInline ref={videoEl} className={styles['video-player']}></video>
      </div>
      <RoomJoin room={room} onRoomChange={onRoomChange} onJoinRoom={onJoinRoom} />
    </div>
  );
}

export default memo(App);
