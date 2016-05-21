using LearningTree.Models;
using LearningTree.Models.ViewModel;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace LearningTree.Controllers
{
    [Authorize]
    public class TeachingRoomController : Controller
    {
        // GET: TeachingRoom
        [HttpPost]
        public ActionResult Index(string question)
        {
            var vm = new TeachingRoomViewModel();
            var uman = new FakeUserManager();

            vm.DisplayName = User.Identity.Name;
            vm.UserId = uman.GetUserId(User.Identity.Name);
            vm.DisplayQuestion = question ?? "";
           
            return View(vm);
        }
    }
}