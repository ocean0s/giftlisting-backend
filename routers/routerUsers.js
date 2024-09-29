const express = require("express") 
const database = require("../database")
const activeApiKeys = require("../activeApiKeys")
const jwt = require("jsonwebtoken")

let routerUsers = express.Router()

routerUsers.post("/", async (req, res) => {
    let email = req.body.email
    let username = req.body.username
    let password = req.body.password
    let errors = []
    if (email == undefined || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email))
        errors.push({ error: "Invalid format for email" })
    if (username == undefined || username == "")
       errors.push({ error: "Invalid format for username" })
    if (password == undefined || password.length < 5)
        errors.push({ error: "Invalid format for password" })
    if (errors.length != 0)
        return res.status(400).json({ error: errors })

    // Validación: email no en uso. Se podría comprobar también un nombre de 
    // usuario no repetido pero no esta especificado.
    database.connect()
    let repeated
    try {
        repeated = await database.query(
            "SELECT COUNT(*) as count FROM users WHERE email = ?", [email]) // len 1 array
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during query" })
    }

    if (repeated[0].count != 0) { // repeated
        database.disconnect()
        return res.status(400).json({ error: "Email already in use" })
    }

    try {
        await database.query(
            "INSERT INTO users (email, username, password) VALUES (?, ?, ?)", 
            [email, username, password])
    } catch (e) {
        return res.status(500).json({ error: "Error during creation" })
    } finally {
        database.disconnect()
    }

    return res.json({inserted: true})
})

routerUsers.post("/login", async (req, res) => {
    let email = req.body.email
    let password = req.body.password
    let errors = []
    if (email == undefined || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email))
        errors.push({ error: "Invalid format for email" })
    if (password == undefined || password.length < 5)
        errors.push({ error: "Invalid format for password" })
    if (errors.length != 0)
        return res.status(400).json({ error: errors })

    database.connect()
    let userInfo
    try {
        userInfo = await database.query(
            "SELECT id FROM users WHERE email = ? AND password = ?", [email, password])
    } catch (e) {
        return res.status(500).json({ error: "Error during query" })
    } finally {
        database.disconnect()
    }

    if (userInfo.length == 0)
        return res.status(401).json({ error: "Incorrect email-password combination" })

    let { id: userId } = userInfo[0]
    let apiKey = jwt.sign({
        userId: userId, 
        email: email,
        date: Date.now() }, "secret")
    activeApiKeys.push(apiKey)
    return res.json({apiKey: apiKey})
})

routerUsers.post("/disconnect", (req, res) => {
    let apiKey = req.query.apiKey // must not be undefined if reached this point
    let index = activeApiKeys.indexOf(apiKey)
    if (index > -1) {
        activeApiKeys.splice(index,1)
        return res.json({ disconnected: true })
    }
    return res.status(400).json({ error: "Could not find the user for this API key"})
})

module.exports = routerUsers