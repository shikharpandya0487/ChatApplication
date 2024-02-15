const mongoose=require('mongoose')

const connectDb=()=>{
    try {
        mongoose
          .connect(`${process.env.MONGO_URL}`)
          .then(() => {
            console.log("Connection successful");
          })
          .catch((e) => {
            console.log("Error in connecting", e);
          });
      }
    catch (error) {
        console.log("error in connecting DB");
      }
    }

module.exports=connectDb