const dotenv = require("dotenv");
const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./src/models/user.models.js");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt=require('bcrypt')
const ws=require('ws')
const Message =require('./src/models/message.models.js')
const fs = require('fs')
const connectDb=require('./src/dB/connectDB.db.js')
const testRouter=require('./src/routes/user.routes.js')
app.use(cookieParser());
dotenv.config();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

const port = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET;

const bcryptSalt = bcrypt.genSaltSync(10);

// it's now using ws later convert it as per socket.io library 
async function getUserData(request){
  return new Promise((res,rej)=>{
  const token = request.cookies?.token;

        if(token)
        {
          jwt.verify(token,jwtSecret,{},(err,userData)=>{
          if(err) throw err;
          res(userData)})
        }
        else
        {
          rej("NO token")
        }
    }) 

}

const server=app.listen(4000, () => {
  console.log("Listening on port ", port);
});

// Db Connection 

connectDb()



app.use("/test",testRouter);
  
app.get("/profile", (req, res) => {
  const token = req.cookies?.token;
  console.log("In profile page ");
   
  if (token) {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) throw err;
      res.status(201).json({userData,token});
      console.log(userData,token);
    }) 
  } else {  
    res.status(401).json("no token check here");
  }
});  

app.post('/register', async (req,res) => {
    const {username,password} = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
      const createdUser = await User.create({
        username:username,
        password:hashedPassword,
      });
      console.log(createdUser);
      jwt.sign({userId:createdUser._id,username}, jwtSecret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token, {sameSite:'none', secure:true}).status(201).json({
          id: createdUser._id,
        });
      });
    } catch(err) {
      if (err) throw err;
      res.status(500).json('error');
    }
  });
 

app.post('/login', async (req,res) => {
    const {username, password} = req.body;
    const foundUser = await User.findOne({username});
    if (foundUser) {
        console.log("Calling the new route \n",foundUser);
      const passOk = bcrypt.compareSync(password, foundUser.password);
      if (passOk) {
        jwt.sign({userId:foundUser._id,username}, jwtSecret, {}, (err, token) => 
        {
          res.cookie('token', token, {sameSite:'none', secure:true}).json({
            id: foundUser._id,
          });      
         
        });
      }
    }
  });
  
  //get request to get all the old chats from the id 
app.get('/messages/:userId',async (req,res)=>{
  // In a Node.js web server using a framework like Express, 
  // req.params is an object containing properties mapped to the named route parameters.
   const {userId}=req.params
   const userData=await getUserData(req)
 

  console.log(userData);
   console.log(userId);

   const OuruserId= userData.userId
   console.log(OuruserId);

   const messages= await Message.find({
    sender:{$in:[userId,OuruserId]},
    recipient:{$in:[userId,OuruserId]}
   }).sort({createdAt:1}).exec();

  //  console.log(messages)
   //exec() is used to execute
   //decending order
  res.json(messages)

});  

// api end point for getting people who are offline
app.get('/people',async (req,res)=>{
  // passing 1 to the object property means we are selecting only id and username of the user
  const users=await User.find({},{'_id':1,'username':1})
  // console.log(users);
  res.json(users)
})
   
  const wss=new ws.WebSocketServer({server})
 
 
  wss.on('connection',(connection,req)=>{


    //mechanism to notify everyone about the live and offline customers
    // The method used to do this known as ping pong mech
    // ping sent by server --> client to check whether it' s alive
    // pong sent by client --> server to tell it's alive 
    // if t
    function notifyAllOnlinePeople()
    {
      [...wss.clients].forEach(client=>{
        client.send(JSON.stringify({
          online:[...wss.clients].map((c)=>({userId:c.userId,username:c.username}))
        }))
      }); 
    }
       
    //creating new property .isAlive indicating the online status
    connection.isAlive=true 
     
    //a ping after every 5sec
    connection.timer=setInterval(()=>{
      connection.ping()
      
      //If connection not recieved in 1.5 sec the client is considered disconnected 

      connection.deathTime=setTimeout(()=>{
        connection.isAlive=false
        clearInterval(connection.timer);
        connection.terminate();
        notifyAllOnlinePeople();
        // console.log("dead connection")
      },1500)
    },5000)


    const response=req.headers.cookie
    if(response)
    {
        const tokenCookieString=response.split(';').find(str=>str.startsWith('token='))
        //  console.log(tokenCookieString);
        const token=tokenCookieString.split('=')[1]
        if(token)  
        {
          jwt.verify(token,jwtSecret,{},(err,userData)=>{
            if(err) throw err;

            // console.log(userData);
            const {username,userId}=userData

            connection.userId=userId
            connection.username=username
          }); 
        notifyAllOnlinePeople()
          // console.log([...wss.clients].map((c)=>c.username));

        
        }      
     }
  
  
    connection.on('message',async (message)=>{
      // console.log("hello");
      // console.log(message);
      // Here we need to convert the buffer data to string and then further to object for further use 
      const messageData=JSON.parse(message.toString())
      const {recipient, text, file} = messageData;
      let filename = null;
      if (file) {
        console.log('size', file.data.length);
        const parts = file.name.split('.');
        const ext = parts[parts.length - 1];
        filename = Date.now() + '.'+ext;
        const path = __dirname + '/uploads/' + filename;
        const bufferData = new Buffer(file.data.split(',')[1], 'base64');
        fs.writeFile(path, bufferData, () => {
          console.log('file saved:'+path);
        });
    }

    
    if(recipient && text)  
    {
        
              // creating the msg --> in DB
              const messageDocument=await Message.create({
                sender:connection.userId,
                recipient:recipient,
                text
              });   
        //we send the text to other person
       [...wss.clients].filter((c)=>{   
          if(c.userId===recipient)
          {
            return c
          }
        }).forEach(c=>{
          c.send(JSON.stringify({
            text,
            sender:connection.userId,
            _id:messageDocument._id,
            recipient,
            file: file ? filename : null,
          }))
        })
      }
    }); 
    notifyAllOnlinePeople()

 
}) 


//making a logout post route
app.post('/logout',(req,res)=>{
    console.log("logging out");
   //clear cookies
    res.clearCookie('token',{sameSite:"none",secure:true})
    .status(200)
    .json({message:"Ok deletion done"});
})