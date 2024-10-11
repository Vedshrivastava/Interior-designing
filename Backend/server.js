import express from "express"
import cors from "cors"
import {connectDB} from './config/db.js'
import designRouter from "./routes/design.js"
import router from "./routes/appointments.js"
import 'dotenv/config.js'
import dotenv from 'dotenv'
import admin from "./routes/admin.js"
import user from "./routes/user.js"

dotenv.config()

const app = express()
const port = 3000

app.use(express.json())
app.use(cors())

connectDB(process.env.MONGO_URI)

app.use('/api/design', designRouter)
app.use('/api/appointment', router)
app.use('/api/admin', admin)
app.use('/api/user', user)

app.use('/images', express.static('uploads'));

app.get("/", (req, res) => {
    res.send("API Working")
})

app.listen(port, () => {
    console.log(`server started on http://localhost:${port}`)
})