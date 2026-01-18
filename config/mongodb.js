import mongoose from "mongoose";

const connectDB = async () => {
  mongoose.connection.on('connected', () => console.log("Database Connected"));

  let uri;

  if (process.env.NODE_ENV === "development") {
    uri = process.env.MONGO_URI;
  } else {
    uri = `${process.env.MONGO_URI}/TuDate`;
  }

  await mongoose.connect(uri);
};

export default connectDB;
