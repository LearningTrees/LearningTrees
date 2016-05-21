using Microsoft.AspNet.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web;

namespace LearningTree.Hubs
{
    [Authorize]
    public class TeachingHub : Hub
    {
        private readonly static ConnectionMapping<string> _connections =
            new ConnectionMapping<string>();

        

        public override Task OnConnected()
        {
            string name = Context.User.Identity.Name;

            _connections.Add(name, Context.ConnectionId);

            UpdateClientUserList(name);
            return base.OnConnected();
        }

        public override Task OnDisconnected(bool stopCalled)
        {
            string name = Context.User.Identity.Name;

            _connections.Remove(name, Context.ConnectionId);
            UpdateClientUserList(name);
            return base.OnDisconnected(stopCalled);
        }

        public override Task OnReconnected()
        {
            string name = Context.User.Identity.Name;

            if (!_connections.GetConnections(name).Contains(Context.ConnectionId))
            {
                _connections.Add(name, Context.ConnectionId);
                UpdateClientUserList(name);
            }

            return base.OnReconnected();
        }
    
 

        public void Send(string name, string message)
        {
            // Call the addNewMessageToPage method to update clients.
            Clients.All.addNewMessageToPage(name, message);
        }

        public void Receive(string sender, object data, object compose)
        {


            Clients.Others.receive(sender, data);
        }

        public void ReceiveDrawing(object data)
        {
            var d = data;
        }

        public void UpdateClientUserList(string who)
        {

            var users = _connections.GetAllUsers();
            

            Clients.All.updateUserlist(users.ToArray());

            
        }

        public void Clear()
        {
            Clients.All.clearCanvas();
        }
    }
}