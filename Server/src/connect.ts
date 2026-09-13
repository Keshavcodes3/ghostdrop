import { WebSocket } from 'ws'



class AllClients{
    private userSocketSet =new Set<WebSocket>()

    addClient=(client:WebSocket)=>{
        this.userSocketSet.add(client)
    }

    removeClient=(client:WebSocket)=>{
        this.userSocketSet.delete(client)
    }

    broadCastMessages=(sender:WebSocket,payload:string)=>{
        for(const client of this.userSocketSet){
            if(client !== sender && client.readyState === WebSocket.OPEN){
                client.send(payload)
            }
        }
    }


}



export default new AllClients()
