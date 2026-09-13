import { WebSocket } from 'ws';
class AllClients {
    userSocketSet = new Set();
    addClient = (client) => {
        this.userSocketSet.add(client);
    };
    removeClient = (client) => {
        this.userSocketSet.delete(client);
    };
    broadCastMessages = (sender, payload) => {
        for (const client of this.userSocketSet) {
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    };
}
export default new AllClients();
//# sourceMappingURL=connect.js.map