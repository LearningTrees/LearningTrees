using Microsoft.Owin;
using Owin;

[assembly: OwinStartupAttribute(typeof(LearningTree.Startup))]
namespace LearningTree
{
    public partial class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            ConfigureAuth(app);

            app.MapSignalR();
        }
    }
}
