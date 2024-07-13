const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const cors = require("cors");
const app = express();

const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const port = process.env.PORT || 5000;

// middleware:
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://fix-fast-63d93.web.app",
      "https://fix-fast-63d93.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("FixFast is running...");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q1nysvk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// custom middleware:

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send("not authorize");
  }
  jwt.verify(token, process.env.USER_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send("not authorize");
    }

    // if token is valid it will be in the decoded
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // await client.connect();

    const serviceCollection = client.db("fixFastDB").collection("services");
    const bookedServiceCollection = client
      .db("fixFastDB")
      .collection("booked_services");
    const newsCollection = client.db("fixFastDB").collection("news");

    // get all services from db
    app.get("/services", async (req, res) => {
      const servicePerPage = Number(req.query?.totalPerPage);
      const currentPage = Number(req.query?.currentPage);
      const search = req.query?.search;
      const query = search
        ? { service_name: { $regex: search, $options: "i" } }
        : {};

      let result;
      if (search) {
        result = await serviceCollection.find(query).toArray();
      } else {
        result = await serviceCollection
          .find(query)
          .skip((currentPage - 1) * servicePerPage)
          .limit(servicePerPage)
          .toArray();
      }
      res.send(result);
    });

    app.get("/services-count", async (req, res) => {
      const count = await serviceCollection.countDocuments();
      res.send({ count });
    });

    // get a single service by _id:
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    // get all services by a specific user:
    app.get("/user-services", verifyToken, async (req, res) => {
      const email = req.query?.email;
      const loggedUserEmail = req.user?.loggedUser;
      if (email !== loggedUserEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (email) {
        query = { "provider_info.email": email };
      }
      const result = await serviceCollection.find(query).toArray();
      res.send(result);
    });

    // get all booked services by a specific user:
    app.get("/booked-services", verifyToken, async (req, res) => {
      const email = req.query?.email;
      const loggedUserEmail = req.user?.loggedUser;

      if (email !== loggedUserEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (email) {
        query = { current_user_email: email };
      }

      const result = await bookedServiceCollection.find(query).toArray();
      res.send(result);
    });

    // get all services to do by a specific service provider
    app.get("/todo-services", verifyToken, async (req, res) => {
      const loggedUserEmail = req.user?.loggedUser;
      const email = req.query?.email;

      if (email !== loggedUserEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (email) {
        query = { provider_email: email };
      }
      const result = await bookedServiceCollection.find(query).toArray();
      res.send(result);
    });

    // get all news
    app.get("/news", async (req, res) => {
      const result = await newsCollection.find().toArray();
      res.send(result);
    });

    // get a single news by id
    app.get("/news/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newsCollection.findOne(query);
      res.send(result);
    });

    // Jaw generate token:
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.USER_TOKEN_SECRET, {
        expiresIn: "7hr",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // clear cookie token:
    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
        .send({ success: true });
    });

    // save service info to db
    app.post("/add-service", async (req, res) => {
      const serviceInfo = req.body;
      const result = await serviceCollection.insertOne(serviceInfo);
      res.send(result);
    });

    // save booked service info:
    app.post("/booked-service", async (req, res) => {
      const bookedService = req.body;
      const result = await bookedServiceCollection.insertOne(bookedService);
      if (result.insertedId) {
        const {
          current_user_email,
          current_user_name,
          service_name,
          price,
          provider_email,
          provider_name,
        } = bookedService;

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: current_user_email,
          subject: "Congratulation! Service Booked Successful",
          text: current_user_name,
          html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #333;">Thank You for Booking a Service with FixFast!</h2>
            <p>Dear ${current_user_name},</p>
            <p>Thank you for booking the <strong>${service_name}</strong> service through FixFast. We are delighted to have you as a customer.</p>
            <p>Here are the details of your booking:</p>
            <ul>
              <li><strong>Service:</strong> ${service_name}</li>
              <li><strong>Price:</strong> ${price}</li>
              <li><strong>Service Provider:</strong> ${provider_name}</li>
              <li><strong>Service Provider Email:</strong> <a href="mailto:${provider_email}">${provider_email}</a></li>
            </ul>
            <p>If you have any questions or need further assistance, please feel free to contact us or your service provider directly.</p>
            <p>We hope you have a great experience with FixFast and look forward to serving you again in the future.</p>
            <p>Best regards,</p>
            <p>The FixFast Team</p>
            <footer style="margin-top: 20px; color: #777;">
              <p>FixFast - Your trusted service-sharing platform for electronics.</p>
              <p><a href="https://fix-fast-63d93.web.app" style="color: #007bff; text-decoration: none;">Visit our website</a> | <a href="mailto:towhidmorol46@gmail.com" style="color: #007bff; text-decoration: none;">Contact Support</a></p>
            </footer>
          </div>
          `,
        };
        try {
          await transporter.sendMail(mailOptions);
          console.log("Email send successfully");
        } catch (error) {
          console.log("Email send failed");
        }
      }
      res.send(result);
    });

    // delete a service by id:
    app.delete("/delete-service/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    // partially update a service using PATCH method:
    app.patch("/update-service", async (req, res) => {
      const id = req.query?.id;
      const service = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedService = {
        $set: { ...service },
      };
      const result = await serviceCollection.updateOne(filter, updatedService);
      res.send(result);
    });

    // update only serviceStatus by using PATCH method:
    app.patch("/update-service-status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.currentStatus;
      const filter = { _id: new ObjectId(id) };
      const updatedStatus = {
        $set: { serviceStatus: status },
      };
      const result = await bookedServiceCollection.updateOne(
        filter,
        updatedStatus
      );
      res.send(result);
    });

    // delete a booked service by Id:
    app.delete("/booked-service/:id", async (req, res) => {
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookedServiceCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`FixFast is running at http://localhost:${port}`);
});
