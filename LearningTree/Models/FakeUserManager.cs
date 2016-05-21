using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace LearningTree.Models
{

    public class User {

        public string Username { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
    }
    public class FakeUserManager
    {


        public FakeUserManager(){

        }

        public User FindUser(string email, string passworad)
        {
            User user = null;
            if ((email == "student@learningtree.com" && passworad == "ab123456") || (email == "teacher@learningtree.com" && passworad == "ab123456"))
            {
                var username = email == "student@learningtree.com" ? "student" : "teacher";
                user = new User() { Username = username, Password = passworad };
            }

            return user;
        }

        public int GetUserId(string username)
        {
            var id = username == "student" ? 1 : username == "teacher" ? 2 : 0;
            return id;
        }
        

        
    }
}