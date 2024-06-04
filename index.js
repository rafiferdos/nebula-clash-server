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
    optionsSuccessStatus: 200
}

// middlewares
app.use(cors(corsOptions))
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