const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


//middleware
app.use(cors())
app.use(express.json())
//RES  ||  RES123456


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.drqortc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    /**----------------------------------------------------
    * --------------------------------ALL DATABASE---------
    * -----------------------------------------------------
    */
    const menuCollection = client.db('BistroDb').collection('menu')
    const reviewsCollection = client.db('BistroDb').collection('reviews')
    const cartCollection = client.db('BistroDb').collection('carts')
    const userCollection = client.db('BistroDb').collection('users')
    const paymentCollection = client.db('BistroDb').collection('payments')

    /**------------------------------------------------
    * __________________________ Middlewares ______________ 
    * -------------------------------------------------
    */
    //verify token
    const verifyToken = (req, res, next) => {
      // console.log("Inside verify token", req.headers.authorization)

      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access " })
      }
      const token = req.headers.authorization.split(' ')[1]
      // console.log(token)
      jwt.verify(token, process.env.ACCESS_TOKEN_SECTET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "unauthorized access for error" })
        }
        // console.log(decoded)
        req.decoded = decoded

        next()
      })

    }
    //after vefify token 
    const verifyAdmin = async (req, res, next) => {

      const email = req.decoded?.email;

      const query = { email: email }
      const user = await userCollection.findOne(query)

      const isAdmin = user?.role === 'admin'

      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }


    /**------------------------------------------------
    * __________________________ JWT __________________ 
    * -------------------------------------------------
    */


    // Creating token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECTET, { expiresIn: '1h' })
      //  console.log(token)
      res.send({ token })
    })

    /**------------------------------------------------
    * __________________________ USERS __________________ 
    * -------------------------------------------------
    */
    //get single user
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(req.decoded?.email)
      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "forbiden acess" })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      // console.log(user)
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }

      res.send({ admin });
    })

    //create user   
    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user)
      //inser email if user doesnot exist
      /**
       * way : (1 mail unique, 2 upset  3 simple checking)
       */
      const query = { email: user.emial }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: "You can not create accout", insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    //get users
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers)
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    //delete user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })



    //admin (to make admin)
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: { //seting a field 
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })






    /**------------------------------------------------
     * ___________________CARTS ______________________
     * ------------------------------------------------
     */
    //Adding data
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem)
      res.send(result)
    })
    //Geting data
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    //delete data
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })





    /**--------------------------------------------
     * _____________________________MENU ________________
     * ----------------------------------------------
     */
    //Geting data
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find({}).toArray()
      res.send(result)
    })


    //add item 
    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      // console.log(item)
      const result = await menuCollection.insertOne(item)

      res.status(200).send(result)
    })

    //delete 
    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id

      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })


    //get single item
    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query)
      res.send(result)
    })

    //update single item
    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const { name,
        category,
        price,
        recipe,
        image } = item;


      const filer = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: name,
          category: category,
          price: price,
          recipe: recipe,
          image: image
        }
      }
      const result = await menuCollection.updateOne(filer, updatedDoc)

      res.send(result)

    })

    /**-------------------------------------------------
     * ___________________________REVIEWS________________
     * ------------------------------------------------
     */
    //Geting data
    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find({}).toArray()
      res.send(result)
    })



    /**------------------------------------------------
     * ___________________ Payment ______________________
     * ------------------------------------------------
     */

    //paymnet histry
    app.get('/payments/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      // if(req.params.email!== req.decoded){
      //   return res.status(401).send({message: 'forbidden access'})
      // }

      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      // Validate the price
      if (price == null || isNaN(price) || price <= 0) {
        return res.status(400).send({ error: 'Invalid price provided' });
      }

      // Convert price to cents
      const amount = Math.round(price * 100); // Convert to cents

      // Custom minimum amount validation (Stripe minimum is typically $0.50 or 50 cents for USD)
      const minAmount = 1; // Minimum amount in cents (e.g., 50 cents)
      if (amount < minAmount) {
        return res.status(400).send({ error: 'Amount must be at least $0.50' });
      }

      try {
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ['card']
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).send({ error: 'Failed to create payment intent' });
      }
    });



    // app.post("/create-payment-intent", async (req, res) => {
    //   const { price } = req.body;
    //   // console.log(price)
    //   const amount = parseInt(price *100)

    //   // console.log('ammout iside the instend',amount)
    //   // Create a PaymentIntent with the order amount and currency
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: amount,
    //     currency: "usd",
    //     payment_method_types:['card']

    //   });
    //   res.send({
    //     clientSecret: paymentIntent.client_secret,
    //   });
    // });

    //payment histioy 
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //carefully delte each item from the cart
      // console.log("Payment info",payment)
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      }
      const deleteResult = await cartCollection.deleteMany(query)
      res.send({ paymentResult, deleteResult })

    })





      /**------------------------------------------------
      * ___________________ Analytics ______________________
      * ------------------------------------------------
      */




      app.get('/admin-stats',verifyToken,verifyAdmin,async(req,res)=>{
        const users = await userCollection.estimatedDocumentCount();
        const menuItems = await menuCollection.estimatedDocumentCount();
        const orders = await paymentCollection.estimatedDocumentCount();
        //this is not the best way
        // const payments = await paymentCollection.find().toArray()
        // const revenue = payments.reduce((total,payment)=>total + payment.price,0)
        // console.log(revenue)

        //way 1
        const result = await paymentCollection.aggregate([
          {
            $group:{
              _id: null,
              tatalRevenue: {
                $sum: '$price'
              }
            }
          }
        ]).toArray()
    
        const revenue = result.length > 0 ? result[0].tatalRevenue: 0

        res.send({
          users,
          menuItems,
          orders,
          revenue
        })
      })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("this is restruent")
})

app.listen(port, () => {
  console.log(`server is runnig at ${port}`)
})

/**
 * ------------------
 * Naming convention
 * -------------------
 */
/**
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users)
 * app.put('/users/:id)
 * app.patch('/users/:id)
 * app.delete('/users/:id)
 */