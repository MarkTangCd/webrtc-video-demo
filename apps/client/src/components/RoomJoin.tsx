import { memo } from 'react';
import {
  Button,
  Text,
  Input,
} from '@chakra-ui/react';
import styles from './RoomJoin.module.css';

interface IProps {
  room: string;
  onRoomChange: (room: string) => void;
  onJoinRoom: () => void;
}

function RoomJoin(props: IProps) {
  const { room, onRoomChange, onJoinRoom } = props;

  return (
    <div className={styles['input-section']}>
      <div className={styles['content']}>
        <span className={styles['label-text']}>Room ID:</span>
        <div className={styles['room-id']}>
          <Input value={room} onChange={(e) => onRoomChange(e.target.value)} placeholder="Please input the room id" />
        </div>
        <div className={styles['join-btn']}>
          <Button size='md' onClick={onJoinRoom}>Join</Button>
        </div>
      </div>
    </div>
  );
}

export default memo(RoomJoin);
