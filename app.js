const express = require("express")
const jwt = require("jsonwebtoken")
const cors = require("cors")

const activeApiKeys = require("./activeApiKeys")
const routerUsers = require("./routers/routerUsers")
const routerPresents = require("./routers/routerPresents")
const routerFriends = require("./routers/routerFriends")

const app = express()
const port = 4000

app.use(cors())
app.use(express.json())

app.use(["/users/disconnect", "/presents", "/friends"], (req,res,next) => {
    console.log("Middleware execution")

    let apiKey = req.query.apiKey
    if (apiKey == undefined)
        return res.status(401).json({ error: "No API key provided" })
    
    let infoApiKey
    try {
        infoApiKey = jwt.verify(apiKey, "secret")
    } catch (e) {
        return res.status(401).json({ error: "API key provided is invalid" })
    }

    if ( infoApiKey == undefined || activeApiKeys.indexOf(apiKey) == -1){
		return res.status(401).json({ error: "API key provided is invalid" });
	}

    req.infoApiKey = infoApiKey
    next()
})

app.use("/users", routerUsers)
app.use("/presents", routerPresents)
app.use("/friends", routerFriends)

app.listen(port,  () => {
    console.log("App running in port ", port)
})