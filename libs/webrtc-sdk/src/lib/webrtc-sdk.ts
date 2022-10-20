import io, { Socket } from 'socket.io-client';
import {
  JOIN,
  JOINED,
  LEAVED,
  LEAVE,
  MESSAGE,
  DISCONNECT,
  OTHER_JOINED,
  BYE,
  FULL,
  BASE_URL
} from '@webrtc-video-demo/webrtc-sdk';
import { pcConfig, ClientState } from '../constants';

interface Events {
  onJoined: () => void;
  onLeaved: () => void;
  onCustomerJoined: (room: string, id: string) => void;
  onFull: (room: string, id: string) => void;
  onBye: () => void;
  onDisconnect: () => void;
}

interface WebRTCClientOptions {
  localElement?: HTMLVideoElement | HTMLAudioElement;
  remoteElement: HTMLVideoElement | HTMLAudioElement;
  events: Events;
}

export class WebRTCClient {
  socket?: Socket;
  localElement?: HTMLVideoElement | HTMLAudioElement;
  remoteElement: HTMLVideoElement | HTMLAudioElement;
  events: Events;
  state: ClientState;
  roomID?: string;
  offerDesc?: RTCLocalSessionDescriptionInit;
  pc?: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream;

  constructor(options: WebRTCClientOptions) {
    this.localElement = options.localElement;
    this.remoteElement = options.remoteElement;
    this.events = options.events;
    this.state = ClientState.INIT;
    this.connSignalServer();
  }

  private joined(roomID: string, id: string) {
    console.log('receive joined message:', roomID, this.state);
    this.state = ClientState.JOINED;
    this.createPeerConnection();
    this.bindTracks();
    this.events.onJoined();
  }

  private leaved(roomID: string) {
    console.log('receive leaved message:', roomID, this.state);
    this.state = ClientState.LEAVED;
    this.socket?.disconnect();
    // 像外部回调Leaved事件
    this.events.onLeaved();
  }

  public leave() {
    if (this.socket) {
      this.socket.emit(LEAVE, this.roomID);
      this.hangUp();
      this.closeLocalMedia();
    }
  }

  private otherJoined(roomID: string) {
    console.log('receive otherjoined message:', roomID, this.state);
    if (this.state === ClientState.JOINED_UNBIND) {
      this.createPeerConnection();
      this.bindTracks();
    }

    this.state = ClientState.JOINED_CONN;
    this.call();
  }

  private call() {
    if (this.state === ClientState.JOINED_CONN && this.pc) {
      const offerOptions: RTCOfferOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      }

      this.pc.createOffer(offerOptions)
        .then(this.getOffer.bind(this))
        .catch(this.handleOfferError);
    }
  }

  private handleOfferError(err: any) {
    throw new Error('Failed to create offer:' + err);
  }

  private getOffer(desc: RTCLocalSessionDescriptionInit) {
    if (this.roomID) {
      this.pc?.setLocalDescription(desc);
      this.offerDesc = desc;
      //TODO: 将offer desc sdp数据传递给外部事件


      this.sendMessage(this.roomID, this.offerDesc);
    }
  }

  private sendMessage(roomID: string, data: any) {
    if (!this.socket) {
      throw Error('Socket is null');
    }
    // 传递SDP给Signal server
    this.socket.emit(MESSAGE, roomID, data);
  }

  private full(roomID: string) {
    console.log('receive full message:', roomID, this.state);
    this.socket?.disconnect();
    this.hangUp();
    this.closeLocalMedia();
    this.state = ClientState.LEAVED;
    // 像外部回调房间已满事件
  }

  private closeLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    this.localStream = undefined;
  }

  private hangUp() {
    if (!this.pc) {
      throw new Error('pc is null or undefined!');
    }

    this.offerDesc = undefined;
    this.pc.close();
    this.pc = undefined;
  }

  private bye(roomID: string) {
    console.log('receive bye message:', roomID, this.state);
    this.state = ClientState.JOINED_UNBIND;
    this.hangUp();
    // 回调Bye，清空offer SDP和 Answer SDP
    this.events.onBye();
  }

  private disconnect() {
    console.log('receive disconnect message!', this.roomID);
    if (this.state !== ClientState.LEAVED) {
      this.hangUp();
      this.closeLocalMedia();
    }
    this.state = ClientState.LEAVED;
  }

  private bindTracks() {
    if (!this.pc) {
      throw new Error('pc is null or undefined!');
    }

    if (!this.localStream) {
      throw new Error('localStream is null or undefined!');
    }

    this.localStream.getTracks().forEach((track) => {
      this.pc?.addTrack(track, this.localStream as MediaStream);
    });
  }

  private message(roomID: string, data: any) {
    console.log('receive message!', this.roomID, data);

    if (!data) {
      console.error('the message is invalid!');
      return;
    }

    if (data.hasOwnProperty('type') && data.type === 'offer') {
      // 可以回调传递offer sdp数据出去 data.sdp

      this.pc?.setRemoteDescription(new RTCSessionDescription(data));

      this.pc?.createAnswer()
        .then(this.getAnswer.bind(this))
        .catch(this.handleAnswerError);
    } else if (data.hasOwnProperty('type') && data.type === 'answer') {
      // 可以回调传递answer sdp数据出去 data.sdp
      this.pc?.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.hasOwnProperty('type') && data.type === 'candidate') {
      let candidate = new RTCIceCandidate({
        sdpMLineIndex: data.label,
        candidate: data.candidate
      });
      this.pc?.addIceCandidate(candidate);
    } else {
      throw new Error('the message is invalid!');
    }
  }

  private getAnswer(desc: RTCLocalSessionDescriptionInit) {
    if (this.roomID) {
      this.pc?.setLocalDescription(desc);
      // 可以回调传递answer sdp数据出去 desc.sdp
      this.sendMessage(this.roomID, desc);
    }
  }

  private handleAnswerError(err: any) {
    console.error(err);
    throw new Error('Failed to create answer');
  }

  private bindEvents() {
    if (this.socket) {
      this.socket.on(JOINED, this.joined.bind(this));
      this.socket.on(LEAVED, this.leaved.bind(this));
      this.socket.on(OTHER_JOINED, this.otherJoined.bind(this));
      this.socket.on(MESSAGE, this.message.bind(this));
      this.socket.on(FULL, this.full.bind(this));
      this.socket.on(BYE, this.bye.bind(this));
      this.socket.on(DISCONNECT, this.disconnect.bind(this));
    }
  }

  private createPeerConnection() {
    if (!this.pc) {
      this.pc = new RTCPeerConnection(pcConfig);

      this.pc.onicecandidate = (e) => {
        if (e.candidate && this.roomID) {
          this.sendMessage(this.roomID, {
            type: 'candidate',
            label: e.candidate.sdpMLineIndex,
            id: e.candidate.sdpMid,
            candidate: e.candidate.candidate
          });
        } else {
          console.log('this is the end candidate');
        }
      }

      console.log('bind the on track event');
      this.pc.ontrack = this.getRemoteStream.bind(this);
    } else {
      throw Error('the pc have be created!');
    }
  }

  private getRemoteStream(e: RTCTrackEvent) {
    console.log('receive remote data');
    console.log(this.remoteElement);
    this.remoteStream = e.streams[0];
    console.log(this.remoteStream);
    this.remoteElement.srcObject = e.streams[0];
    this.remoteElement.play();
  }

  private connSignalServer() {
    this.start();
  }

  private start() {
    if (!navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia) {
      throw Error('the getUserMedia is not supported!');
    } else {
      let constraints;

      if (this.localElement instanceof HTMLAudioElement) {
        constraints = {
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }
      } else if (this.localElement instanceof HTMLVideoElement) {
        constraints = {
          video: {
            width: 640,
            height: 480,
            frameRate: 15,
            facingMode: 'enviroment'
          },
          audio: false
        }
      } else {
        constraints = {
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }
      }

      navigator.mediaDevices.getUserMedia(constraints)
        .then(this.getMediaStream.bind(this))
        .catch(this.handleError);
    }
  }

  private connect() {
    this.socket = io(BASE_URL);

    this.bindEvents();
  }

  private getMediaStream(stream: MediaStream) {
    if (this.localStream) {
      stream.getAudioTracks().forEach((track) => {
        this.localStream?.addTrack(track);
        stream.removeTrack(track);
      });
    } else {
      this.localStream = stream;
    }

    if (this.localElement) {
      this.localElement.srcObject = this.localStream;
    }

    // setup connection
    this.connect();
  }

  private handleError(e: any) {
    console.error(e);
    throw new Error('Failed to get Media Stream!');
  }

  public join(room: string) {
    if (room !== '' && this.socket) {
      this.roomID = room;
      this.socket.emit(JOIN, room);
    } else {
      throw Error('Not connected to signaling server.');
    }
  }

}
