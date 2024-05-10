const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const app = express();

const port = process.env.PORT || 5000;

// middleware:
app.use(cors());
app.use(express.json());

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

async function run() {
  try {
    // await client.connect();

    const serviceCollection = client.db("fixFastDB").collection("services");
    const bookedServiceCollection = client
      .db("fixFastDB")
      .collection("booked_services");

    // get all services from db
    app.get("/services", async (req, res) => {
      const result = await serviceCollection.find().toArray();
      res.send(result);
    });

    // get a single service by _id:
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    // get all services by a specific user:
    app.get("/user-services", async (req, res) => {
      const email = req.query?.email;
      const query = { "provider_info.email": email };
      const result = await serviceCollection.find(query).toArray();
      res.send(result);
    });

    // get all booked services by a specific user:
    app.get('/booked-services', async(req, res)=>{
      const email = req.query?.email;
      const query = { current_user_email: email };
      const result = await bookedServiceCollection.find(query).toArray();
      res.send(result);
    })

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
      res.send(result);
    });

    // delete a service by id:
    app.delete("/delete-service/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    // update a service using PATCH method:
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
