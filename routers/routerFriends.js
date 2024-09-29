const express = require("express") 
const database = require("../database")

let routerFriends = express.Router()

routerFriends.post("/", async (req, res) => {
    let emailFriend = req.body.emailFriend
    let listName = req.body.listName
    let { email: emailUser } = req.infoApiKey
    if (emailFriend == undefined || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(emailFriend))
        return res.status(400).json({ error: "Invalid format for friend email" })
    if (listName == undefined || listName == "")
        return res.status(400).json({ error: "Invalid format for list" })
    
    if (emailFriend == emailUser)
        return res.status(400).json({ error: "You cannot become your own friend" })
    
    database.connect()
    
    //check if user exists for the friend email
    let infoFriend
    try{
        infoFriend = await database.query(
            "SELECT COUNT(*) as count FROM users WHERE email = ?",
            [emailFriend])
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during existence check" })
    }
    
    if (infoFriend[0].count == 0) {
        database.disconnect()
        return res.status(400).json({ error: "Friend email is not associated with any account" })
    }

    // check if already existent
    let repeated
    try{
        repeated = await database.query(
            "SELECT COUNT(*) as count FROM friends WHERE emailMainUser = ? AND emailFriend = ? AND listName = ?",
            [emailUser, emailFriend, listName])
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during repetition check" })
    }
    
    if (repeated[0].count != 0) {
        database.disconnect()
        return res.status(400).json({ error: "Friend already added" })
    }

    // not yet created -> add an entry

    let infoUser
    try {
        infoUser = await database.query(
            "SELECT id FROM users where email = ?",
            [emailUser]
        )
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during user ID query" })
    }
    let userId = infoUser[0].id

    let isList
    try {
        isList = await database.query(
            "SELECT COUNT(*) as count FROM lists WHERE userId = ? AND listName = ?",
            [userId, listName]
        )
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during list query" })
    }

    // creacion si no existe lista
    if (isList[0].count != 1) {
        try {
            await database.query(
                "INSERT INTO lists (userId, listName) VALUES (?, ?)",
                [userId, listName]
            )
        } catch (e) {
            database.disconnect()
            return res.status(500).json({ error: "Error during list creation" })
        }
    }

    try{
        await database.query(
            "INSERT INTO friends (emailMainUser, emailFriend, listName) VALUES (?, ?, ?)",
            [emailUser, emailFriend, listName])
    } catch (e) {
        return res.status(500).json({ error: "Error during insertion" })
    } finally {
        database.disconnect()
    }

    return res.json({ added: true })
})

routerFriends.get("/", async (req, res) => {
    let { email } = req.infoApiKey

    database.connect()
    let friends
    try {
        friends = await database.query(
            "SELECT emailFriend, listName FROM friends WHERE emailMainUser = ?",
        [email])
    } catch (e) {
        return res.status(500).json({ error: "Error during query" })
    } finally {
        database.disconnect()
    }

    let friendsData = friends.map( f => ({emailFriend: f.emailFriend, listName: f.listName}))
    return res.json({ friends: friendsData })
})

routerFriends.delete("/:email", async (req, res) => {
    let emailFriend = req.params.email
    let { email: emailUser } = req.infoApiKey
    let listName = req.body.listName
    if (emailFriend == undefined || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(emailFriend))
        return res.status(400).json({ error: "Invalid format for email" })
    if (emailFriend == emailUser)
        return res.status(400).json({ error: "You cannot delete yourself" })
    if (listName == undefined || listName == "")
        return res.status(400).json({ error: "Invalid format for list" })

    // check if friends
    database.connect()
    let isFriend
    try{
        isFriend = await database.query(
            "SELECT COUNT(*) as count FROM friends WHERE emailMainUser = ? AND emailFriend = ? AND listName = ?",
            [emailUser, emailFriend, listName])
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during friend check" })
    }
    
    if (isFriend[0].count == 0) {
        database.disconnect()
        return res.status(400).json({ error: "Email does not belong to any of your friend-list combinations" })
    } // else, email corresponds to a friend

    try{
        await database.query(
            "DELETE FROM friends WHERE emailMainUser = ? AND emailFriend = ? AND listName = ?",
            [emailUser, emailFriend, listName])
    } catch (e) {
        return res.status(500).json({ error: "Error during deletion" })
    } finally {
        database.disconnect()
    }

    return res.json({ deleted: true })
})

module.exports = routerFriends