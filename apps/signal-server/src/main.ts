import * as express from 'express';
import { Server } from 'socket.io';
import * as http from 'http';
import * as cors from 'cors';
import * as log4js from 'log4js';
import {
  MESSAGE,
  JOIN,
  JOINED,
  FULL,
  LEAVE,
  LEAVED,
  OTHER_JOINED,
  BYE
} from '@webrtc-video-demo/webrtc-sdk';

const USER_COUNT = 3;

log4js.configure({
  appenders: {
    file: {
      type: 'file',
      filename: 'app.log',
      layout: {
        type: 'pattern',
        pattern: '%r %p - %m',
      }
    }
  },
  categories: {
    default: {
      appenders: ['file'],
      level: 'debug'
    }
  }
});

const logger = log4js.getLogger();

const app = express();
const server = http.createServer(app);
const port = process.env.port || 3333;
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

app.use(cors);

server.listen(port, () => {
  console.log(`Listening on *:${port}`);
});

server.on('error', console.error);

io.sockets.on('connection', (socket) => {
  socket.on(MESSAGE, (room, data) => {
    logger.debug(`message, room: ${room}, data, type:${data.type}`);
    socket.to(room).emit('message', room, data);
  });

  socket.on(JOIN, (room) => {
    socket.join(room);
    let clientsInRoom = io.sockets.adapter.rooms.get(room);
    let total = clientsInRoom ? clientsInRoom.size : 0;
    logger.debug(`the user number of room (${room}) is: ${total}`);

    if (total < USER_COUNT) {
      socket.emit(JOINED, room, socket.id); // 发给除自己之外的房间内的所有人

      if (total > 1) {
        socket.to(room).emit(OTHER_JOINED, room, socket.id);
      }
    } else {
      socket.leave(room);
      socket.emit(FULL, room, socket.id);
    }
  });

  socket.on(LEAVE, (room) => {
    socket.leave(room);

    let clientsInRoom = io.sockets.adapter.rooms.get(room);
    let total = clientsInRoom ? clientsInRoom.size : 0;
    logger.debug(`the user number of room is: ${total}`);

    socket.to(room).emit(BYE, room, socket.id);
    socket.emit(LEAVED, room, socket.id);
  });
});
