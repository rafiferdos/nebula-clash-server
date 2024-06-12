require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')



const port = process.env.PORT || 9000
const app = express()

const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://nebula-clash.web.app/'],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}

// middlewares
app.use(cors(corsOptions))
app.options("", cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

const tokenVerify = async (req, res, next) => {
    const token = req.cookies?.token
    if (!token) {
        return res.status(401).send('Unauthorized access')
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send('Invalid token')
        }
        req.user = decoded
        next()
    })
}

// uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.9s7yoy1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // database
        const nebula_database = client.db('nebula_clash_db')

        //collections
        const contests_collection = nebula_database.collection('contests')
        const users_collection = nebula_database.collection('users')
        const submissions_collection = nebula_database.collection('submissions')
        const payments_collection = nebula_database.collection('payments')

        // routes

        // get all contests from db
        app.get('/all-contests', async (req, res) => {
            const contests = await contests_collection.find({}).toArray();
            res.send(contests);
        });

        // create contest
        app.post('/create-contest', async (req, res) => {
            const contest = req.body
            const result = await contests_collection.insertOne(contest)
            res.send(result)
        });

        // update contest by id
        app.put("/update-contest/:id", async (req, res) => {
            try {
                const contestId = req.params.id;
                const updatedContestData = req.body;

                const result = await contests_collection.updateOne(
                    { _id: new ObjectId(contestId) },
                    { $set: updatedContestData }
                );

                res.send(result);
            } catch (error) {
                console.error("Error updating contest:", error);
                res.status(500).send({ error: "Failed to update contest" });
            }
        });

        // delete contest by id
        app.delete("/delete-contest/:id", async (req, res) => {
            try {
                const contestId = req.params.id;
                const result = await contests_collection.deleteOne({ _id: new ObjectId(contestId) });

                res.send(result);
            } catch (error) {
                console.error("Error deleting contest:", error);
                res.status(500).send({ error: "Failed to delete contest" });
            }
        });

        // get all contests created by user email
        app.get('/my-contests/:email', async (req, res) => {
            const email = req.params.email
            const contests = await contests_collection.find({ "creator.email": email }).toArray();
            res.send(contests);
        });

        // get all contests that are popular by total participation count in descending order
        app.get('/popular-contests', async (req, res) => {
            const contests = await contests_collection.aggregate([
                { $match: {} },
                { $addFields: { participantCount: { $size: "$participants" } } },
                { $sort: { participantCount: -1 } },
                { $limit: 6 }
            ]).toArray();
            res.send(contests);
        });

        // get contest details by id
        app.get('/contest-details/:id', async (req, res) => {
            const contest = await contests_collection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(contest);
        });

        // get all winners from finished contests
        app.get('/winners', async (req, res) => {
            try {
                const finishedContests = await contests_collection.find({ status: "finished" }).toArray();
                const winnerIds = finishedContests.map(contest => contest.winnerId);

                const winners = await users_collection.find({ _id: { $in: winnerIds } }).toArray();

                res.send(winners);
            } catch (error) {
                // ... error handling
            }
        });

        // get all users from db
        app.get('/all-users', async (req, res) => {
            const users = await users_collection.find({}).toArray();
            res.send(users);
        });

        // get all users from db except current user by email
        app.get('/all-users-except/:email', async (req, res) => {
            const email = req.params.email
            const users = await users_collection.find({ email: { $ne: email } }).toArray();
            res.send(users);
        });

        // get user by email
        app.get('/user/:email', async (req, res) => {
            const user = await users_collection.findOne({ email: req.params.email });
            res.send(user);
        });

        // update user role by id
        app.put("/update-user/:id", async (req, res) => {
            // just update the status property of the user
            try {
                const userId = req.params.id;
                const updatedUserData = req.body;

                const result = await users_collection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: updatedUserData }
                );

                res.send(result);
            } catch (error) {
                console.error("Error updating user:", error);
                res.status(500).send({ error: "Failed to update user" });
            }
        });

        // save a user in db
        app.put('/save-user', async (req, res) => {
            const user = req.body
            const query = { email: user?.email }
            // check if user already exists in db
            const isExist = await users_collection.findOne(query)
            if (isExist) {
              if (user.status === 'Requested') {
                // if existing user try to change his role
                const result = await users_collection.updateOne(query, {
                  $set: { status: user?.status },
                })
                return res.send(result)
              } else {
                // if existing user login again
                return res.send(isExist)
              }
            }
      
            // save user for the first time
            const options = { upsert: true }
            const updateDoc = {
              $set: {
                ...user,
                timestamp: Date.now(),
              },
            }
            const result = await users_collection.updateOne(query, updateDoc, options)
            res.send(result)
          })

          // delete user by id
            app.delete("/delete-user/:id", async (req, res) => {
                try {
                    const userId = req.params.id;
                    const result = await users_collection.deleteOne({ _id: new ObjectId(userId) });
    
                    res.send(result);
                } catch (error) {
                    console.error("Error deleting user:", error);
                    res.status(500).send({ error: "Failed to delete user" });
                }
            });

        // jwt
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1d' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
                })
                .send({ success: true })
        })

        app.get('/logout', async (req, res) => {
            res.clearCookie('token')
            res.send('Logged out')
        })
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})