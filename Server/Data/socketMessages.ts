export type IceCandidateInit = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export type SignalMessage =
  | {
      type: "JOIN_ROOM";
      roomId: string;
      peerId: string;
    }
  | {
      type: "LEAVE_ROOM";
      roomId: string;
      peerId: string;
    }
  | {
      type: "OFFER";
      roomId: string;
      from: string;
      to: string;
      sdp: string;
    }
  | {
      type: "ANSWER";
      roomId: string;
      from: string;
      to: string;
      sdp: string;
    }
  | {
      type: "ICE_CANDIDATE";
      roomId: string;
      from: string;
      to: string;
      candidate: IceCandidateInit;
    };

export type ServerMessage =
  | {
      type: "ROOM_JOINED";
      roomId: string;
      peerId: string;
      peers: string[];
    }
  | {
      type: "PEER_JOINED";
      roomId: string;
      peerId: string;
    }
  | {
      type: "PEER_LEFT";
      roomId: string;
      peerId: string;
      reason: "left" | "disconnect";
    }
  | {
      type: "ROOM_FULL";
      roomId: string;
    }
  | {
      type: "ROOM_EXPIRED";
      roomId: string;
    }
  | {
      type: "ERROR";
      code: string;
      message: string;
    }
  | SignalMessage;
