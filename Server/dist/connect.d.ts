import { WebSocket } from 'ws';
declare class AllClients {
    private userSocketSet;
    addClient: (client: WebSocket) => void;
    removeClient: (client: WebSocket) => void;
    broadCastMessages: (sender: WebSocket, payload: string) => void;
}
declare const _default: AllClients;
export default _default;
//# sourceMappingURL=connect.d.ts.map